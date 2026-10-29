import { apiError, HttpError, json, rateLimit, readBody } from "@/lib/http";
import { ADMIN_COOKIE, ADMIN_TTL, passwordMatches, signTicket, takeRateLimit } from "@/lib/security";
import { configurationStatus } from "@/lib/server-config";

export async function POST(req: Request) {
  try {
    rateLimit(req, "login", 5, 60_000);
    if (!takeRateLimit("login:global", 50, 60_000)) throw new HttpError(429, "För många inloggningsförsök. Vänta en minut.");
    const body = await readBody(req);
    const config = configurationStatus();
    if (!config.password || !config.authSecret) throw new HttpError(503, "Admin är inte konfigurerad. Ange BROADCAST_PASSWORD (minst 12 tecken) och AUTH_SECRET (minst 32 tecken) på servern.");
    if (!passwordMatches(body.password)) throw new HttpError(401, "Fel lösenord. Försök igen.");
    const response = json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, signTicket({ purpose: "admin" }, ADMIN_TTL), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: ADMIN_TTL,
    });
    return response;
  } catch (error) { return apiError(error); }
}
