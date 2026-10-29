import { json } from "@/lib/http";

// Legacy clients cannot decrement a shared counter or stop another listener's audio.
export async function POST() { return json({ ok: true }); }
