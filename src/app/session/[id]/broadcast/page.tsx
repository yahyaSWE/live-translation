import { redirect } from "next/navigation";
import BroadcastConsole from "@/components/BroadcastConsole";
import { isAdmin } from "@/lib/http";
import TranslationSessionManager from "@/lib/translation-session-manager";

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) redirect("/admin");
  const { id } = await params;
  const session = TranslationSessionManager.getInstance().getSession(id);
  if (!session) redirect("/admin");
  return <BroadcastConsole sessionId={id} title={session.title} />;
}
