import { apiError, HttpError, json, requireAdmin } from "@/lib/http";
import TranslationSessionManager from "@/lib/translation-session-manager";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("sessionId");
    const manager = TranslationSessionManager.getInstance();
    if (!id || !manager.getSession(id)) throw new HttpError(404, "Sändningen finns inte.");
    return json({ listenerCount: await manager.listenerCount(id), translation: manager.translationStatus() });
  } catch (error) { return apiError(error); }
}
