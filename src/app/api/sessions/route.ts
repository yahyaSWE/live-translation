import { apiError, HttpError, json, readBody, requireAdmin } from "@/lib/http";
import { configurationReady } from "@/lib/server-config";
import TranslationSessionManager from "@/lib/translation-session-manager";

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await readBody(req);
    if (!configurationReady()) throw new HttpError(503, "Fyll i de saknade serverinställningarna innan du startar.");
    const title = typeof body.title === "string" ? body.title.trim() : "Direktöversättning";
    if (!title || title.length > 100) throw new HttpError(400, "Ange ett namn på 1–100 tecken.");
    const session = await TranslationSessionManager.getInstance().createSession(title);
    return json({ sessionId: session.sessionId, broadcastUrl: `/session/${session.sessionId}/broadcast`, joinUrl: "/" }, 201);
  } catch (error) { return apiError(error); }
}

export async function GET() {
  try { await requireAdmin(); return json({ session: TranslationSessionManager.getInstance().getSession() ?? null }); }
  catch (error) { return apiError(error); }
}
