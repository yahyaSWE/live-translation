export type LiveStatus = {
  state: "waiting" | "paused" | "starting" | "live" | "interrupted";
  sessionId: string | null;
  title: string;
  targetLanguage: string;
};

export type AdminStatus = {
  configuration: { gemini: boolean; livekit: boolean; password: boolean; authSecret: boolean };
  session: { sessionId: string; title: string; createdAt: number } | null;
  live: LiveStatus;
  maxListeners: number;
};
