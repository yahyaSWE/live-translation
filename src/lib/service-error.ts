export type ServiceErrorCode = "GEMINI_AUTH" | "GEMINI_QUOTA" | "GEMINI_MODEL" | "GEMINI_SETUP_INVALID" | "GEMINI_CONNECT" | "GEMINI_TIMEOUT" | "LIVEKIT_CONNECT" | "LIVEKIT_PUBLISH" | "BRIDGE_RUNTIME";

const messages: Record<ServiceErrorCode, string> = {
  GEMINI_AUTH: "Gemini nekade åtkomst. Kontrollera API-nyckeln och att projektet har åtkomst till Live Translate.",
  GEMINI_QUOTA: "Geminis kvot är uppnådd. Kontrollera API-projektets kvot och fakturering och försök sedan igen.",
  GEMINI_MODEL: "Gemini-modellen är inte tillgänglig. Kontrollera modellnamnet och projektets modellåtkomst.",
  GEMINI_SETUP_INVALID: "Gemini avvisade startinställningarna. Kontrollera att senaste appversionen är publicerad och se felkoden i Render-loggen.",
  GEMINI_CONNECT: "Servern kunde inte ansluta till Gemini. Kontrollera Render-loggen och försök igen.",
  GEMINI_TIMEOUT: "Gemini svarade inte när översättningen startades. Försök igen om en stund.",
  LIVEKIT_CONNECT: "Ljudbryggan kunde inte ansluta till LiveKit. Kontrollera LiveKit-adress, nycklar och Render-loggen.",
  LIVEKIT_PUBLISH: "Ljudbryggan kunde inte publicera ljud i LiveKit. Kontrollera Render-loggen.",
  BRIDGE_RUNTIME: "Serverns ljudmodul kunde inte starta. Kontrollera Render-loggen.",
};

export class ServiceError extends Error {
  readonly publicMessage: string;
  constructor(readonly code: ServiceErrorCode, readonly stage: string, cause?: unknown) {
    super(messages[code], { cause });
    this.name = "ServiceError";
    this.publicMessage = messages[code];
  }
}

export function safeErrorDetails(error: unknown): string {
  let text = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown upstream error";
  for (const name of ["GEMINI_API_KEY", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "BROADCAST_PASSWORD", "AUTH_SECRET"]) {
    const value = process.env[name];
    if (value) {
      text = text.split(value).join("[REDACTED]");
      text = text.split(encodeURIComponent(value)).join("[REDACTED]");
    }
  }
  return text
    .replace(/([?&](?:key|api_key|token|access_token|password|secret)=)[^&#\s"']+/gi, "$1[REDACTED]")
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\bAIza[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
    .replace(/[\r\n\x00-\x1f]/g, " ")
    .slice(0, 600);
}

export function geminiError(cause: unknown, status?: number): ServiceError {
  const text = cause instanceof Error ? cause.message : String(cause);
  const code: ServiceErrorCode = status === 429 || /resource.exhausted|quota|rate.limit/i.test(text) ? "GEMINI_QUOTA"
    : status === 401 || status === 403 || /api.key|permission.denied|unauthenticated|unauthorized/i.test(text) ? "GEMINI_AUTH"
    : status === 404 || /model.*(?:not.found|not.supported|unavailable)|not.found.*model/i.test(text) ? "GEMINI_MODEL"
    : status === 400 || status === 1007 || /invalid.argument|invalid.json|unknown.name|cannot.find.field/i.test(text) ? "GEMINI_SETUP_INVALID"
    : "GEMINI_CONNECT";
  return new ServiceError(code, "gemini.setup", cause);
}

export function logServiceError(error: ServiceError) {
  console.error("[Translation]", { code: error.code, stage: error.stage, detail: safeErrorDetails(error.cause ?? error) });
}
