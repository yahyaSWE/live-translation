import { Room, RoomEvent, TrackKind, AudioStream } from "@livekit/rtc-node";

const base = process.env.LOAD_TEST_URL;
const count = Number(process.env.LOAD_TEST_LISTENERS || 200);
const seconds = Number(process.env.LOAD_TEST_SECONDS || 60);
if (!base || !Number.isInteger(count) || count < 1 || count > 200 || !Number.isFinite(seconds) || seconds < 10 || seconds > 600) {
  console.error("Ange LOAD_TEST_URL, LOAD_TEST_LISTENERS (1–200) och LOAD_TEST_SECONDS (10–600). Starta en riktig sändning och prata under testet.");
  process.exit(1);
}
const origin = new URL(base).origin;
const rooms = [];
const readers = [];
const durations = [];
const withAudio = new Set();
let frames = 0;
let disconnected = 0;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled(readers.map((reader) => reader.cancel()));
  await Promise.allSettled(rooms.map((room) => room.disconnect()));
}
process.once("SIGINT", () => { void shutdown().finally(() => process.exit(130)); });
process.once("SIGTERM", () => { void shutdown().finally(() => process.exit(143)); });

try {
  const statusResponse = await fetch(`${origin}/api/live`, { signal: AbortSignal.timeout(15_000) });
  const live = await statusResponse.json();
  if (!statusResponse.ok || live.state !== "live") throw new Error("En aktiv sändning med svensk översättning krävs.");
  console.log(`Ansluter ${count} lyssnare till ${origin}. Testtid efter anslutning: ${seconds} sekunder.`);
  const result = await Promise.allSettled(Array.from({ length: count }, async (_, index) => {
    const start = performance.now();
    const response = await fetch(`${origin}/api/token`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ role: "attendee", sessionId: live.sessionId }), signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Tokenanrop: HTTP ${response.status}`);
    const credentials = await response.json();
    const room = new Room();
    rooms.push(room);
    const subscribe = (pub, participant) => { if (participant.identity === "translator-sv" && pub.kind === TrackKind.KIND_AUDIO) pub.setSubscribed(true); };
    room.on(RoomEvent.TrackPublished, subscribe);
    room.on(RoomEvent.Disconnected, () => { if (!shuttingDown) disconnected++; });
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (participant.identity !== "translator-sv" || publication.kind !== TrackKind.KIND_AUDIO) return;
      const reader = new AudioStream(track, { sampleRate: 16_000, numChannels: 1, frameSizeMs: 100 }).getReader();
      readers.push(reader);
      void (async () => {
        try {
          while (!shuttingDown) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) { withAudio.add(index); frames++; }
          }
        } catch { /* Disconnect closes media readers. */ }
        finally { reader.releaseLock(); }
      })();
    });
    await room.connect(credentials.serverUrl, credentials.token, { autoSubscribe: false });
    for (const p of room.remoteParticipants.values()) for (const pub of p.trackPublications.values()) subscribe(pub, p);
    durations.push(performance.now() - start);
  }));
  const failed = result.filter((item) => item.status === "rejected").length;
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  durations.sort((a, b) => a - b);
  console.log(JSON.stringify({ requested: count, connected: durations.length, failed, receivedAudio: withAudio.size, audioFrames: frames, unexpectedDisconnects: disconnected, joinP95Ms: Math.round(durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] || 0) }, null, 2));
  if (failed || disconnected || withAudio.size !== count) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Testet misslyckades.");
  process.exitCode = 1;
} finally { await shutdown(); }
