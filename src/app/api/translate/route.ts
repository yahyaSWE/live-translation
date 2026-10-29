import { apiError, HttpError, json, readBody, requireAdmin } from "@/lib/http";
import TranslationSessionManager from "@/lib/translation-session-manager";

// Only the broadcaster can start billable translation work.
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await readBody(req);
    if (body.targetLanguage !== "sv" || typeof body.sessionId !== "string") throw new HttpError(400, "Endast svenska är aktiverat.");
    const bridge = await TranslationSessionManager.getInstance().ensureTranslation(body.sessionId);
    return json({ translatorIdentity: bridge.identity, status: bridge.status });
  } catch (error) { return apiError(error); }
}
