import { randomUUID } from "node:crypto";
import type { TranslationBridge } from "./translation-bridge";
import { roomService } from "./livekit-server";
import { MAX_LISTENERS, TARGET_LANGUAGE } from "./server-config";
import { HttpError } from "./http";

export const HOST_TIMEOUT_MS = 45_000;
const MAX_SESSION_MS = 4 * 60 * 60 * 1000;

export interface SessionInfo {
  sessionId: string;
  organizerIdentity: string;
  title: string;
  createdAt: number;
  lastHeartbeat: number;
  broadcasting: boolean;
  allowedLanguages: string[];
}

type Bridge = Pick<TranslationBridge, "identity" | "status" | "start" | "stop" | "onStop">;
export type SessionDependencies = {
  rooms: () => Pick<ReturnType<typeof roomService>, "createRoom" | "deleteRoom" | "listRooms" | "listParticipants">;
  bridge: (session: SessionInfo) => Promise<Bridge>;
  now: () => number;
};

const defaults: SessionDependencies = {
  rooms: roomService,
  now: Date.now,
  bridge: async (session) => {
    const { TranslationBridge } = await import("./translation-bridge");
    return new TranslationBridge(session.sessionId, TARGET_LANGUAGE, session.organizerIdentity, {
      geminiApiKey: process.env.GEMINI_API_KEY!, livekitUrl: process.env.LIVEKIT_URL!,
      livekitApiKey: process.env.LIVEKIT_API_KEY!, livekitApiSecret: process.env.LIVEKIT_API_SECRET!,
    });
  },
};

export class TranslationSessionManager {
  private session?: SessionInfo;
  private bridge?: Bridge;
  private starting?: Promise<Bridge>;
  private creating?: Promise<SessionInfo>;
  private stopping?: Promise<void>;
  private cleanup?: ReturnType<typeof setInterval>;

  constructor(private deps: SessionDependencies = defaults) {}

  static getInstance(): TranslationSessionManager {
    const state = globalThis as typeof globalThis & { ltSessions?: TranslationSessionManager };
    return state.ltSessions ??= new TranslationSessionManager();
  }

  getSession(id?: string) { return this.session && (!id || this.session.sessionId === id) ? this.session : undefined; }

  createSession(title: string): Promise<SessionInfo> {
    if (this.creating) return this.creating;
    const pending = this.create(title);
    this.creating = pending;
    void pending.finally(() => { if (this.creating === pending) this.creating = undefined; }).catch(() => {});
    return pending;
  }

  private async create(title: string) {
    await this.stopping;
    if (this.session) throw new HttpError(409, "En sändning finns redan. Öppna eller avsluta den först.");
    const rooms = this.deps.rooms();
    // Clean up only this application's orphan rooms after a process restart.
    const previous = await rooms.listRooms();
    for (const room of previous) {
      if (room.name.startsWith("lt-") && room.metadata === "live-translate-v1") await rooms.deleteRoom(room.name);
    }
    const session: SessionInfo = {
      sessionId: `lt-${randomUUID()}`, organizerIdentity: `organizer-${randomUUID()}`,
      title, createdAt: this.deps.now(), lastHeartbeat: this.deps.now(),
      broadcasting: false, allowedLanguages: [TARGET_LANGUAGE],
    };
    await rooms.createRoom({ name: session.sessionId, maxParticipants: MAX_LISTENERS + 2, emptyTimeout: 300, departureTimeout: 60, metadata: "live-translate-v1" });
    this.session = session;
    this.cleanup ??= setInterval(() => {
      if (this.session && (this.deps.now() - this.session.lastHeartbeat > HOST_TIMEOUT_MS || this.deps.now() - this.session.createdAt > MAX_SESSION_MS)) {
        void this.endSession(this.session.sessionId).catch(() => console.error("[Session] Cleanup failed"));
      }
    }, 10_000);
    this.cleanup.unref();
    return session;
  }

  async heartbeat(id: string, broadcasting: boolean) {
    const session = this.getSession(id);
    if (!session) throw new HttpError(404, "Sändningen har avslutats. Skapa en ny från admin.");
    session.lastHeartbeat = this.deps.now();
    session.broadcasting = broadcasting;
    if (broadcasting) await this.ensureTranslation(id);
  }

  ensureTranslation(id: string): Promise<Bridge> {
    const session = this.getSession(id);
    if (!session) return Promise.reject(new HttpError(404, "Sändningen finns inte."));
    if (this.starting) return this.starting;
    if (this.bridge?.status === "active") return Promise.resolve(this.bridge);
    const pending = (async () => {
      const old = this.bridge;
      this.bridge = undefined;
      if (old) { old.onStop = undefined; await old.stop(); }
      const bridge = await this.deps.bridge(session);
      if (this.session !== session) { await bridge.stop(); throw new Error("Session ended"); }
      this.bridge = bridge;
      bridge.onStop = () => { if (this.bridge === bridge) this.bridge = undefined; };
      try {
        await bridge.start();
        if (this.session !== session) { await bridge.stop(); throw new Error("Session ended"); }
        return bridge;
      } catch (error) {
        bridge.onStop = undefined;
        await bridge.stop().catch(() => {});
        if (this.bridge === bridge) this.bridge = undefined;
        throw error;
      }
    })();
    this.starting = pending;
    void pending.finally(() => { if (this.starting === pending) this.starting = undefined; }).catch(() => {});
    return pending;
  }

  publicStatus() {
    const s = this.session;
    if (!s) return { state: "waiting" as const, sessionId: null, title: "Direktöversättning", targetLanguage: TARGET_LANGUAGE };
    const connected = this.deps.now() - s.lastHeartbeat <= HOST_TIMEOUT_MS;
    const state = !connected ? "interrupted" : !s.broadcasting ? "paused" : this.bridge?.status === "active" ? "live" : "starting";
    return { state, sessionId: s.sessionId, title: s.title, targetLanguage: TARGET_LANGUAGE };
  }

  translationStatus() { return this.bridge?.status || (this.starting ? "starting" : "closed"); }

  async listenerCount(id: string) {
    const participants = await this.deps.rooms().listParticipants(id);
    return participants.filter((p) => p.identity.startsWith("attendee-")).length;
  }

  endSession(id: string): Promise<void> {
    if (this.stopping) return this.stopping;
    if (!this.getSession(id)) return Promise.resolve();
    this.session = undefined;
    if (this.cleanup) clearInterval(this.cleanup);
    this.cleanup = undefined;
    const bridge = this.bridge;
    this.bridge = undefined;
    if (bridge) bridge.onStop = undefined;
    const pending = (async () => {
      await this.starting?.catch(() => {});
      try { await bridge?.stop(); } finally { await this.deps.rooms().deleteRoom(id); }
    })();
    this.stopping = pending;
    void pending.finally(() => { if (this.stopping === pending) this.stopping = undefined; }).catch(() => {});
    return pending;
  }
}

export default TranslationSessionManager;
