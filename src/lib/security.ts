import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "lt_admin";
export const ADMIN_TTL = 8 * 60 * 60;

function signingKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET måste vara minst 32 tecken.");
  return createHmac("sha256", secret).update(process.env.BROADCAST_PASSWORD || "").digest();
}

export function passwordMatches(value: unknown): boolean {
  const expected = process.env.BROADCAST_PASSWORD;
  if (!expected || typeof value !== "string" || value.length > 1024) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(expected).digest());
}

export function signTicket(payload: Record<string, unknown>, ttl: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttl * 1000, nonce: randomBytes(12).toString("hex") })).toString("base64url");
  return `${body}.${createHmac("sha256", signingKey()).update(body).digest("base64url")}`;
}

export function verifyTicket(value: string | undefined, purpose: string): Record<string, unknown> | null {
  if (!value || value.length > 4096) return null;
  try {
    const [body, signature, extra] = value.split(".");
    if (!body || !signature || extra) return null;
    const expected = createHmac("sha256", signingKey()).update(body).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload.purpose === purpose && typeof payload.exp === "number" && payload.exp > Date.now() ? payload : null;
  } catch { return null; }
}

type Bucket = { count: number; reset: number };
const globalState = globalThis as typeof globalThis & { ltRateLimits?: Map<string, Bucket> };
const buckets = globalState.ltRateLimits ??= new Map();

export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > 10_000) {
    for (const [id, bucket] of buckets) if (bucket.reset <= now) buckets.delete(id);
    if (buckets.size > 10_000) return false;
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
