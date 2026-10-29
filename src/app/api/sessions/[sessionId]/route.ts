import { apiError, HttpError, json, readBody, requireAdmin, requireSameOrigin } from "@/lib/http";
import TranslationSessionManager from "@/lib/translation-session-manager";

type Context = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, { params }: Context) {
  const { sessionId } = await params;
  const manager = TranslationSessionManager.getInstance();
  const session = manager.getSession(sessionId);
  if (!session) return json({ error: "Sändningen finns inte." }, 404);
  return json({ sessionId, title: session.title, allowedLanguages: session.allowedLanguages, state: manager.publicStatus().state });
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    await requireAdmin();
    const { sessionId } = await params;
    const body = await readBody(req);
    if (typeof body.broadcasting !== "boolean") throw new HttpError(400, "Ogiltig sändningsstatus.");
    const manager = TranslationSessionManager.getInstance();
    await manager.heartbeat(sessionId, body.broadcasting);
    return json({ live: manager.publicStatus(), translation: manager.translationStatus() });
  } catch (error) { return apiError(error); }
}

export async function DELETE(req: Request, { params }: Context) {
  try {
    await requireAdmin();
    requireSameOrigin(req);
    const { sessionId } = await params;
    await TranslationSessionManager.getInstance().endSession(sessionId);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
