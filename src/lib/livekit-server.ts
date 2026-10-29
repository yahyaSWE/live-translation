import { RoomServiceClient } from "livekit-server-sdk";

export function roomService() {
  const url = process.env.LIVEKIT_URL;
  if (!url || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) throw new Error("LiveKit saknar konfiguration.");
  return new RoomServiceClient(url.replace(/^ws/, "http"), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 10 });
}
