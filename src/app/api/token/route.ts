import { randomUUID } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";
import { apiError, HttpError, json, rateLimit, readBody, requireAdmin } from "@/lib/http";
import { configurationReady } from "@/lib/server-config";
import TranslationSessionManager from "@/lib/translation-session-manager";

export async function POST(req: Request) {
  try {
    // Allows an audience behind one shared venue IP to join together.
    rateLimit(req, "join", 600, 60_000);
    const body = await readBody(req);
    const organizer = body.role === "organizer";
    if (body.role !== "attendee" && !organizer) throw new HttpError(400, "Ogiltig roll.");
    if (organizer) await requireAdmin();
    if (!configurationReady()) throw new HttpError(503, "Sändningen är inte redo. Försök igen senare.");
    const manager = TranslationSessionManager.getInstance();
    const session = typeof body.sessionId === "string" ? manager.getSession(body.sessionId) : undefined;
    if (!session) throw new HttpError(404, "Sändningen har inte startat eller har avslutats.");
    if (!organizer && manager.publicStatus().state !== "live") throw new HttpError(409, "Sändningen är pausad. Vänta tills den startar igen.");
    const identity = organizer ? session.organizerIdentity : `attendee-${randomUUID()}`;
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity, ttl: "10m", attributes: organizer ? {} : { language: "sv" },
    });
    token.addGrant({ roomJoin: true, room: session.sessionId, canPublish: organizer, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false });
    return json({ token: await token.toJwt(), serverUrl: process.env.LIVEKIT_URL, sessionId: session.sessionId });
  } catch (error) { return apiError(error); }
}
