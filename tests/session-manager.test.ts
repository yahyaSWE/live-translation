import { test } from "node:test";
import assert from "node:assert/strict";
import { TranslationSessionManager, HOST_TIMEOUT_MS, type SessionDependencies } from "../src/lib/translation-session-manager";

function fixture(options: { hold?: boolean; fail?: boolean } = {}) {
  let now = 1000;
  let starts = 0;
  let stops = 0;
  let capacity = 0;
  const removed: string[] = [];
  let release = () => {};
  const gate = options.hold ? new Promise<void>((resolve) => { release = resolve; }) : Promise.resolve();
  const bridge = {
    identity: "translator-sv", status: "starting" as "starting" | "active" | "reconnecting" | "closed", onStop: undefined as (() => void) | undefined,
    async start() { starts++; await gate; if (options.fail) throw new Error("Provider refused"); bridge.status = "active"; },
    async stop() { stops++; bridge.status = "closed"; bridge.onStop?.(); },
  };
  const rooms = {
    async createRoom(value: { maxParticipants: number }) { capacity = value.maxParticipants; return {}; },
    async listRooms() { return [{ name: "other-app", metadata: "other" }, { name: "lt-old", metadata: "live-translate-v1" }]; },
    async deleteRoom(id: string) { removed.push(id); },
    async listParticipants() { return [{ identity: "organizer-x" }, { identity: "translator-sv" }, ...Array.from({ length: 200 }, (_, i) => ({ identity: `attendee-${i}` }))]; },
  };
  const manager = new TranslationSessionManager({ rooms: () => rooms as unknown as ReturnType<SessionDependencies["rooms"]>, bridge: async () => bridge, now: () => now });
  return { manager, bridge, release, starts: () => starts, stops: () => stops, capacity: () => capacity, removed, advance: (ms: number) => { now += ms; } };
}

test("200 simultaneous requests share exactly one translation startup", async () => {
  const f = fixture({ hold: true });
  const session = await f.manager.createSession("Test");
  const requests = Array.from({ length: 200 }, () => f.manager.ensureTranslation(session.sessionId));
  f.release();
  const bridges = await Promise.all(requests);
  assert.equal(f.starts(), 1);
  assert.ok(bridges.every((bridge) => bridge === bridges[0]));
  assert.equal(f.capacity(), 202);
  assert.equal(await f.manager.listenerCount(session.sessionId), 200);
  assert.deepEqual(f.removed, ["lt-old"]);
  await f.manager.endSession(session.sessionId);
});

test("concurrent session creation has one result; a second active session is rejected", async () => {
  const f = fixture();
  const sessions = await Promise.all(Array.from({ length: 10 }, () => f.manager.createSession("Test")));
  assert.ok(sessions.every((session) => session.sessionId === sessions[0].sessionId));
  await assert.rejects(f.manager.createSession("Duplicate"));
  await f.manager.endSession(sessions[0].sessionId);
});

test("ending during translation startup cannot resurrect an ended session", async () => {
  const f = fixture({ hold: true });
  const session = await f.manager.createSession("Test");
  const start = f.manager.ensureTranslation(session.sessionId);
  const ending = f.manager.endSession(session.sessionId);
  assert.equal(f.manager.publicStatus().state, "waiting");
  f.release();
  await assert.rejects(start);
  await ending;
  assert.equal(f.manager.getSession(), undefined);
  assert.equal(f.bridge.status, "closed");
  assert.ok(f.removed.includes(session.sessionId));
});

test("failed startup releases the bridge and remains unavailable to listeners", async () => {
  const f = fixture({ fail: true });
  const session = await f.manager.createSession("Test");
  await assert.rejects(f.manager.heartbeat(session.sessionId, true));
  assert.notEqual(f.manager.publicStatus().state, "live");
  assert.equal(f.bridge.status, "closed");
  await f.manager.endSession(session.sessionId);
});

test("paused and stale broadcasts are not advertised as live", async () => {
  const f = fixture();
  const session = await f.manager.createSession("Test");
  assert.equal(f.manager.publicStatus().state, "paused");
  await f.manager.heartbeat(session.sessionId, true);
  assert.equal(f.manager.publicStatus().state, "live");
  f.advance(HOST_TIMEOUT_MS + 1);
  assert.equal(f.manager.publicStatus().state, "interrupted");
  await f.manager.heartbeat(session.sessionId, false);
  assert.equal(f.manager.publicStatus().state, "paused");
  await f.manager.endSession(session.sessionId);
});

test("admin heartbeats do not tear down a bridge while its socket reconnects", async () => {
  const f = fixture();
  const session = await f.manager.createSession("Test");
  await f.manager.heartbeat(session.sessionId, true);
  f.bridge.status = "reconnecting";
  await f.manager.heartbeat(session.sessionId, true);
  assert.equal(f.starts(), 1);
  assert.equal(f.stops(), 0);
  assert.equal(f.manager.publicStatus().state, "starting");
  f.bridge.status = "active";
  assert.equal(f.manager.publicStatus().state, "live");
  await f.manager.endSession(session.sessionId);
});
