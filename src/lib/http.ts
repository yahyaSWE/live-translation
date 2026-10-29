import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, takeRateLimit, verifyTicket } from "./security";
import { logServiceError, safeErrorDetails, ServiceError } from "./service-error";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function isAdmin() {
  return Boolean(verifyTicket((await cookies()).get(ADMIN_COOKIE)?.value, "admin"));
}

export async function requireAdmin() {
  if (!await isAdmin()) throw new HttpError(401, "Logga in som administratör igen.");
}

export function requireSameOrigin(req: Request) {
  const publicUrl = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  const expected = new URL(publicUrl || req.url).origin;
  if (req.headers.get("origin") !== expected || req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Anropet måste komma från den här webbplatsen.");
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  requireSameOrigin(req);
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415, "JSON krävs.");
  if (Number(req.headers.get("content-length")) > 8192) throw new HttpError(413, "Anropet är för stort.");
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Anropet saknar innehåll.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); throw new HttpError(413, "Anropet är för stort."); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new HttpError(400, "Ogiltigt JSON-innehåll."); }
}

export function rateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!takeRateLimit(`${scope}:${ip}`, limit, windowMs)) throw new HttpError(429, "För många försök. Vänta en stund och försök igen.");
}

export function json(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(error: unknown) {
  if (error instanceof ServiceError) {
    logServiceError(error);
    return json({ error: `${error.publicMessage} Felkod: ${error.code}.`, code: error.code }, 503);
  }
  if (error instanceof HttpError) {
    const response = json({ error: error.message }, error.status);
    if (error.status === 429) response.headers.set("Retry-After", "60");
    return response;
  }
  console.error("[API] Operation failed", { type: error instanceof Error ? error.name : "UnknownError", detail: safeErrorDetails(error) });
  return json({ error: "Tjänsten kunde inte slutföra anropet. Försök igen om en stund." }, 503);
}
