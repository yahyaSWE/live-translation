import { json } from "@/lib/http";
import TranslationSessionManager from "@/lib/translation-session-manager";

export async function GET() { return json(TranslationSessionManager.getInstance().publicStatus()); }
