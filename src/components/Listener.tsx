"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useRoomContext } from "@livekit/components-react";
import { ConnectionState, Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrackPublication } from "livekit-client";
import { api, errorMessage } from "@/lib/client-api";
import type { LiveStatus } from "@/lib/public-types";
import SiteBrand from "./SiteBrand";
import { DEFAULT_BROADCAST_TITLE } from "@/lib/brand";

function ListeningControls() {
  const room = useRoomContext();
  const [volume, setVolume] = useState(100);
  const [captions, setCaptions] = useState(true);
  const [text, setText] = useState("");
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const receive = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== "transcription" || participant?.identity !== "translator-sv") return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        if (data.type === "transcription" && data.language === "sv" && typeof data.text === "string") {
          setText((previous) => (previous + data.text).slice(-8000));
        }
      } catch { /* Unrelated or malformed data. */ }
    };
    room.on(RoomEvent.DataReceived, receive);
    return () => { room.off(RoomEvent.DataReceived, receive); };
  }, [room]);

  useEffect(() => {
    const update = () => { for (const p of room.remoteParticipants.values()) p.setVolume(volume / 100); };
    update();
    room.on(RoomEvent.TrackSubscribed, update);
    return () => { room.off(RoomEvent.TrackSubscribed, update); };
  }, [room, volume]);

  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [text]);

  return <div className="listener-controls">
    <StartAudio label="Aktivera ljudet" className="btn btn-dark wide" />
    <label className="field-label" htmlFor="listen-volume">Volym <span>{volume} %</span></label>
    <input id="listen-volume" type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
    <label className="check-label"><input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} /> Visa svensk textning</label>
    {captions && <section className="transcript-section" aria-label="Svensk textning">
      <h2 className="section-title">Predikan på svenska</h2>
      <div ref={transcript} className="transcript-text" tabIndex={0}>
        <p>{text || "Texten visas här när predikan börjar."}</p>
      </div>
      <p className="fine-print">Automatisk översättning kan innehålla fel.</p>
    </section>}
  </div>;
}

export default function Listener({ sessionId }: { sessionId?: string }) {
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connection, setConnection] = useState<"idle" | "connecting" | "connected" | "reconnecting" | "disconnected">("idle");
  const roomRef = useRef<Room | null>(null);
  const activeSession = useRef<string | null>(null);
  const joining = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await api<LiveStatus>("/api/live", { signal: controller.signal });
        if (controller.signal.aborted) return;
        setLive(data);
        setStatusError(false);
        if (activeSession.current && activeSession.current !== data.sessionId) {
          request.current?.abort();
          void roomRef.current?.disconnect();
          setError("Sändningen har avslutats. Du kan lämna sidan eller vänta på nästa sändning.");
        }
      } catch { if (!controller.signal.aborted) setStatusError(true); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 8000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => () => { request.current?.abort(); void roomRef.current?.disconnect(); }, []);

  const leave = useCallback(() => {
    request.current?.abort();
    const previous = roomRef.current;
    roomRef.current = null;
    activeSession.current = null;
    void previous?.disconnect();
    setRoom(null);
    setConnection("idle");
    setError(null);
  }, []);

  async function join() {
    if (joining.current || !live?.sessionId || live.state !== "live") return;
    joining.current = true;
    request.current?.abort();
    const controller = request.current = new AbortController();
    const previous = roomRef.current;
    roomRef.current = null;
    void previous?.disconnect();
    const next = new Room();
    roomRef.current = next;
    activeSession.current = live.sessionId;
    setError(null);
    setConnection("connecting");
    setRoom(next);
    // Unlock playback in the original button gesture, before the network round trip.
    void next.startAudio().catch(() => {});
    const subscribe = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
      if (p.identity === "translator-sv" && pub.kind === Track.Kind.Audio) pub.setSubscribed(true);
    };
    next.on(RoomEvent.TrackPublished, subscribe);
    next.on(RoomEvent.ConnectionStateChanged, (state) => {
      if (roomRef.current !== next) return;
      if (state === ConnectionState.Connected) setConnection("connected");
      else if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) setConnection("reconnecting");
      else if (state === ConnectionState.Disconnected) setConnection("disconnected");
    });
    try {
      const data = await api<{ token: string; serverUrl: string }>("/api/token", { method: "POST", body: JSON.stringify({ role: "attendee", sessionId: live.sessionId }), signal: controller.signal });
      if (controller.signal.aborted) return;
      await next.connect(data.serverUrl, data.token, { autoSubscribe: false });
      if (controller.signal.aborted) { await next.disconnect(); return; }
      for (const p of next.remoteParticipants.values()) for (const pub of p.trackPublications.values()) subscribe(pub, p);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setConnection("disconnected");
        setError(cause instanceof Error && /capacity|participant.*limit|room.*full/i.test(cause.message) ? "Sändningen är full just nu. Försök igen om en stund." : errorMessage(cause));
      }
      await next.disconnect();
    } finally { joining.current = false; }
  }

  const endedLink = Boolean(sessionId && live && live.sessionId !== sessionId);
  const canJoin = !endedLink && !statusError && live?.state === "live";
  const listening = connection === "connected" || connection === "reconnecting";
  const message = !live ? "Hämtar sändningen…" : endedLink ? "Den här sändningen har avslutats." : live.state === "live" ? "Khutbah är igång. Välkommen att lyssna." : live.state === "paused" ? "Predikan förbereds eller är pausad." : live.state === "starting" ? "Översättningen startar. Det tar en liten stund." : live.state === "interrupted" ? "Sändningen har tappat anslutningen. Vi väntar på talaren." : "Ingen sändning pågår just nu. Vi väntar på fredagens khutbah.";

  return <main className={`page audience-page${listening ? " is-listening" : ""}`}>
    <div className="audience-shell">
      <header className="site-header"><SiteBrand /><span className="language-pair">Arabiska till svenska</span></header>
      <section className="audience-main">
        <h1 className="display audience-heading">
          <span className="arabic-title" lang="ar" dir="rtl">خطبة الجمعة</span>
          <span className="heading-swedish">{listening ? <>Du följer khutbah<br />på svenska.</> : <>Fredagens khutbah<br />på svenska.</>}</span>
        </h1>
        <p className="audience-description">{listening ? "Lyssna och följ predikan med svensk textning." : "Ta del av fredagens predikan med direktöversatt ljud och svensk textning."}</p>
        <div className="broadcast-status" role="status"><span className={`live-dot ${live?.state === "live" ? "is-live" : ""}`} aria-hidden="true" /><span>{statusError ? "Kan inte hämta status. Kontrollerar anslutningen igen…" : listening && connection === "reconnecting" ? "Anslutningen bröts. Återansluter automatiskt…" : message}</span></div>
        {live?.sessionId && live.title !== DEFAULT_BROADCAST_TITLE && <p className="broadcast-name">{live.title}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!listening && <button className="btn btn-dark join-button" disabled={!canJoin || connection === "connecting"} onClick={() => void join()}>
          {connection === "connecting" ? "Ansluter…" : connection === "disconnected" ? "Anslut igen" : "Lyssna på svenska"}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>}
        {!listening && <p className="headphone-note">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13h3v8H5a1 1 0 0 1-1-1v-7Zm16 0h-3v8h2a1 1 0 0 0 1-1v-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
          Använd hörlurar och sätt telefonen på ljudlöst.
        </p>}
        {endedLink && <Link href="/" className="btn btn-outline wide">Till aktuell sändning</Link>}
        {room && <LiveKitRoom room={room} serverUrl="" token="" connect={false} audio={false} video={false}>
          <RoomAudioRenderer />
          {listening && <ListeningControls />}
        </LiveKitRoom>}
        {room && <button className="btn btn-outline wide leave-button" onClick={leave}>{listening ? "Sluta lyssna" : "Avbryt anslutningen"}</button>}
      </section>
      <footer className="site-footer"><span>Khutbah · Direktöversättning med AI</span><Link href="/admin">Administratör</Link></footer>
    </div>
  </main>;
}
