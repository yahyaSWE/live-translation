import { isAdmin, json } from "@/lib/http";

export async function GET() { return json({ authenticated: await isAdmin() }); }
