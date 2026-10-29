import Listener from "@/components/Listener";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Listener sessionId={id} />;
}
