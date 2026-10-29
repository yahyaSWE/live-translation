export const MAX_LISTENERS = 200;
export const TARGET_LANGUAGE = "sv";

export function configurationStatus() {
  const url = process.env.LIVEKIT_URL || "";
  let livekitUrl = false;
  try {
    const parsed = new URL(url);
    livekitUrl = parsed.protocol === "wss:" || (process.env.NODE_ENV !== "production" && parsed.protocol === "ws:");
  } catch { /* Admin displays invalid or missing configuration. */ }
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    livekit: Boolean(livekitUrl && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET),
    password: (process.env.BROADCAST_PASSWORD?.length ?? 0) >= 12,
    authSecret: (process.env.AUTH_SECRET?.length ?? 0) >= 32,
  };
}

export function configurationReady() { return Object.values(configurationStatus()).every(Boolean); }
