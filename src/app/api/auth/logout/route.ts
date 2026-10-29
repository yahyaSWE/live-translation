import { apiError, json, requireSameOrigin } from "@/lib/http";
import { ADMIN_COOKIE } from "@/lib/security";

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const response = json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return apiError(error); }
}
