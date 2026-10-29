/** Copyright 2026 Google LLC. Licensed under the Apache License, Version 2.0. */
import { Room, RoomEvent, LocalAudioTrack, AudioSource, AudioFrame, TrackPublishOptions, TrackSource, TrackKind, AudioStream, type RemoteAudioTrack, type RemoteTrackPublication, type RemoteParticipant } from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import WebSocket from "ws";

export type BridgeStatus = "starting" | "active" | "reconnecting" | "error" | "closed";
type Config = { geminiApiKey: string; livekitUrl: string; livekitApiKey: string; livekitApiSecret: string };

export class TranslationBridge {
  readonly identity: string;
  status: BridgeStatus = "starting";
  onStop?: () => void;
  private room?: Room;
  private source?: AudioSource;
  private ws?: WebSocket;
  private sockets = new Set<WebSocket>();
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private hostTimer?: ReturnType<typeof setTimeout>;
  private reconnecting = false;
  private failures = 0;
  private stopped = false;
  private stopPromise?: Promise<void>;
  private resumeHandle?: string;
  private readers = new Map<string, ReadableStreamDefaultReader<AudioFrame>>();
  private audioChain: Promise<void> = Promise.resolve();
  private queuedSeconds = 0;
  private text = "";
  private textTimer?: ReturnType<typeof setTimeout>;
  private segment = 0;

  constructor(readonly sessionId: string, readonly targetLanguage: string, private organizerIdentity: string, private config: Config) {
    this.identity = `translator-${targetLanguage}`;
  }

  async start() {
    try {
      const token = new AccessToken(this.config.livekitApiKey, this.config.livekitApiSecret, { identity: this.identity, ttl: "4h" });
      token.addGrant({ roomJoin: true, room: this.sessionId, canPublish: true, canSubscribe: true, canPublishData: true });
      const room = this.room = new Room();
      room.on(RoomEvent.Disconnected, () => { if (!this.stopped) void this.stop().catch(() => {}); });
      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        if (p.identity !== this.organizerIdentity) return;
        if (this.hostTimer) clearTimeout(this.hostTimer);
        this.hostTimer = setTimeout(() => { if (!room.remoteParticipants.has(this.organizerIdentity)) void this.stop().catch(() => {}); }, 30_000);
      });
      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        if (p.identity === this.organizerIdentity && this.hostTimer) clearTimeout(this.hostTimer);
      });
      // Install listeners before subscribing so an already-published track cannot race startup.
      room.on(RoomEvent.TrackPublished, (pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (p.identity === this.organizerIdentity && pub.kind === TrackKind.KIND_AUDIO) pub.setSubscribed(true);
      });
      room.on(RoomEvent.TrackSubscribed, (track: RemoteAudioTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (p.identity === this.organizerIdentity && pub.kind === TrackKind.KIND_AUDIO && pub.sid) this.pipeAudio(track, pub.sid);
      });
      await room.connect(this.config.livekitUrl, await token.toJwt(), { autoSubscribe: false, dynacast: false });
      if (this.stopped) throw new Error("Stopped during startup");
      this.source = new AudioSource(24_000, 1, 1000);
      const track = LocalAudioTrack.createAudioTrack(`translated-audio-${this.targetLanguage}`, this.source);
      const options = new TrackPublishOptions();
      options.source = TrackSource.SOURCE_MICROPHONE;
      await room.localParticipant!.publishTrack(track, options);
      await this.openGemini();
      if (this.stopped) throw new Error("Stopped during startup");
      for (const p of room.remoteParticipants.values()) {
        if (p.identity !== this.organizerIdentity) continue;
        for (const pub of p.trackPublications.values()) if (pub.kind === TrackKind.KIND_AUDIO) pub.setSubscribed(true);
      }
      this.status = "active";
    } catch {
      if (!this.stopped) this.status = "error";
      throw new Error("Translation bridge could not start");
    }
  }

  stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    this.stopped = true;
    this.status = "closed";
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.hostTimer) clearTimeout(this.hostTimer);
    if (this.textTimer) clearTimeout(this.textTimer);
    for (const ws of this.sockets) ws.terminate();
    this.sockets.clear();
    this.stopPromise = (async () => {
      await Promise.allSettled(Array.from(this.readers.values(), (reader) => reader.cancel()));
      this.readers.clear();
      try { await this.room?.disconnect(); }
      finally {
        await this.source?.close().catch(() => {});
        this.room = undefined;
        this.source = undefined;
        this.onStop?.();
      }
    })();
    return this.stopPromise;
  }

  private openGemini(): Promise<void> {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.config.geminiApiKey)}`;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { handshakeTimeout: 15_000, maxPayload: 4 * 1024 * 1024 });
      this.sockets.add(ws);
      let ready = false;
      const timeout = setTimeout(() => { ws.terminate(); reject(new Error("Gemini setup timeout")); }, 15_000);
      ws.on("open", () => {
        if (this.stopped) { ws.terminate(); return; }
        ws.send(JSON.stringify({ setup: {
          model: `models/${process.env.GEMINI_MODEL || "gemini-3.5-live-translate-preview"}`,
          generationConfig: {
            responseModalities: ["AUDIO"], outputAudioTranscription: {},
            translationConfig: { targetLanguageCode: this.targetLanguage, echoTargetLanguage: true },
          },
          sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
        } }));
      });
      ws.on("message", (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          if (message.error) { ws.close(); return; }
          if (message.setupComplete) {
            if (this.stopped) { ws.terminate(); return; }
            clearTimeout(timeout);
            ready = true;
            const previous = this.ws;
            this.ws = ws;
            this.failures = 0;
            this.status = "active";
            previous?.close();
            resolve();
            return;
          }
          if (!ready || this.ws !== ws || this.stopped) return;
          if (message.sessionResumptionUpdate?.resumable) this.resumeHandle = message.sessionResumptionUpdate.newHandle;
          if (message.goAway) this.scheduleReconnect(0);
          const content = message.serverContent;
          for (const part of content?.modelTurn?.parts || []) if (part.inlineData?.data) this.queueAudio(part.inlineData.data);
          if (content?.outputTranscription?.text) {
            this.text += content.outputTranscription.text;
            this.textTimer ??= setTimeout(() => { this.textTimer = undefined; this.flushText(false); }, 250);
          }
          if (content?.turnComplete) { this.flushText(true); this.segment++; }
        } catch { /* Ignore malformed provider messages without logging speech. */ }
      });
      ws.on("error", () => { if (!ready) { clearTimeout(timeout); reject(new Error("Gemini connection failed")); } });
      ws.on("close", () => {
        clearTimeout(timeout);
        this.sockets.delete(ws);
        if (!ready) reject(new Error("Gemini closed before setup"));
        if (this.ws === ws && !this.stopped) {
          this.ws = undefined;
          this.status = "reconnecting";
          this.scheduleReconnect();
        }
      });
    });
  }

  private scheduleReconnect(delay = Math.min(1000 * 2 ** this.failures, 15_000)) {
    if (this.stopped || this.reconnecting || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      if (this.stopped) return;
      this.reconnecting = true;
      try { await this.openGemini(); }
      catch {
        this.failures++;
        if (this.failures >= 6) { this.status = "error"; await this.stop().catch(() => {}); }
      } finally {
        this.reconnecting = false;
        if (!this.stopped && !this.ws) this.scheduleReconnect();
      }
    }, delay);
  }

  private pipeAudio(track: RemoteAudioTrack, sid: string) {
    if (this.readers.has(sid) || this.stopped) return;
    const reader = new AudioStream(track, { sampleRate: 16_000, numChannels: 1, frameSizeMs: 100 }).getReader();
    this.readers.set(sid, reader);
    void (async () => {
      try {
        while (!this.stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          const ws = this.ws;
          if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256 * 1024) continue;
          const bytes = Buffer.from(value.data.buffer, value.data.byteOffset, value.data.byteLength);
          ws.send(JSON.stringify({ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: bytes.toString("base64") } } }));
        }
      } catch { /* Track unpublication and shutdown close the reader. */ }
      finally { this.readers.delete(sid); reader.releaseLock(); }
    })();
  }

  private queueAudio(base64: string) {
    const pcm = Buffer.from(base64, "base64");
    const seconds = pcm.length / 2 / 24_000;
    if (!pcm.length || pcm.length % 2 || this.queuedSeconds + seconds > 3) return;
    this.queuedSeconds += seconds;
    this.audioChain = this.audioChain.then(async () => {
      try {
        if (this.stopped || !this.source) return;
        const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
        await this.source.captureFrame(new AudioFrame(samples, 24_000, 1, samples.length));
      } catch { /* Closing the room also closes its audio source. */ }
      finally { this.queuedSeconds -= seconds; }
    });
  }

  private flushText(final: boolean) {
    if (this.textTimer) clearTimeout(this.textTimer);
    this.textTimer = undefined;
    const text = this.text;
    this.text = "";
    if (!text || !this.room?.localParticipant || this.stopped) return;
    const payload = new TextEncoder().encode(JSON.stringify({ type: "transcription", language: this.targetLanguage, segmentId: `${this.identity}-${this.segment}`, text, final, timestamp: Date.now() }));
    void this.room.localParticipant.publishData(payload, { reliable: true, topic: "transcription" }).catch(() => {});
  }
}
