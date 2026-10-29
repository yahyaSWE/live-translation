import { apiError, json, requireAdmin } from "@/lib/http";
import { configurationStatus, MAX_LISTENERS } from "@/lib/server-config";
import TranslationSessionManager from "@/lib/translation-session-manager";

export async function GET() {
  try {
    await requireAdmin();
    const manager = TranslationSessionManager.getInstance();
    const session = manager.getSession();
    return json({ configuration: configurationStatus(), session: session ? { sessionId: session.sessionId, title: session.title, createdAt: session.createdAt } : null, live: manager.publicStatus(), maxListeners: MAX_LISTENERS });
  } catch (error) { return apiError(error); }
}
