import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { passwordMatches, signTicket, takeRateLimit, verifyTicket } from "../src/lib/security";
import { readBody, requireSameOrigin, HttpError } from "../src/lib/http";

beforeEach(() => {
  process.env.AUTH_SECRET = "unit-test-secret-32-characters-long-and-local";
  process.env.BROADCAST_PASSWORD = "test-password-long-enough";
  delete process.env.APP_URL;
  delete process.env.RENDER_EXTERNAL_URL;
});

test("admin tickets reject tampering, expiry and the wrong purpose", () => {
  const ticket = signTicket({ purpose: "admin" }, 60);
  assert.ok(verifyTicket(ticket, "admin"));
  assert.equal(verifyTicket(ticket, "listener"), null);
  assert.equal(verifyTicket(`x${ticket}`, "admin"), null);
  assert.equal(verifyTicket(`${ticket}.extra`, "admin"), null);
  assert.equal(verifyTicket(signTicket({ purpose: "admin" }, -1), "admin"), null);
  assert.equal(verifyTicket(undefined, "admin"), null);
});

test("changing the admin password revokes existing tickets", () => {
  const ticket = signTicket({ purpose: "admin" }, 60);
  process.env.BROADCAST_PASSWORD = "a-new-long-admin-password";
  assert.equal(verifyTicket(ticket, "admin"), null);
});

test("missing secrets and passwords fail closed", () => {
  assert.equal(passwordMatches("test-password-long-enough"), true);
  assert.equal(passwordMatches("wrong"), false);
  assert.equal(passwordMatches({ password: "test-password-long-enough" }), false);
  delete process.env.BROADCAST_PASSWORD;
  assert.equal(passwordMatches(""), false);
  delete process.env.AUTH_SECRET;
  assert.equal(verifyTicket("a.b", "admin"), null);
  assert.throws(() => signTicket({ purpose: "admin" }, 60));
});

test("cross-origin and missing-origin mutations are rejected", () => {
  for (const origin of ["https://attacker.example", null]) {
    const request = new Request("https://translate.example/api/sessions", { headers: origin ? { origin } : {} });
    assert.throws(() => requireSameOrigin(request), (error) => error instanceof HttpError && error.status === 403);
  }
  process.env.APP_URL = "https://translate.example";
  assert.doesNotThrow(() => requireSameOrigin(new Request("http://internal:8080/api/sessions", { headers: { origin: "https://translate.example" } })));
});

test("invalid and oversized request bodies are rejected before work starts", async () => {
  const request = (body: string) => new Request("http://localhost/api", { method: "POST", headers: { origin: "http://localhost", "content-type": "application/json" }, body });
  await assert.rejects(readBody(request("invalid")), (e) => e instanceof HttpError && e.status === 400);
  await assert.rejects(readBody(request("[]")), (e) => e instanceof HttpError && e.status === 400);
  await assert.rejects(readBody(request(JSON.stringify({ value: "a".repeat(9000) }))), (e) => e instanceof HttpError && e.status === 413);
  assert.deepEqual(await readBody(request('{"title":"Fredag"}')), { title: "Fredag" });
});

test("Render's trusted external URL works behind its proxy and rejects forged origins", () => {
  process.env.RENDER_EXTERNAL_URL = "https://live-translate-test.onrender.com";
  const request = (origin: string) => new Request("http://internal:10000/api/auth/login", { headers: { origin, "x-forwarded-host": "attacker.example" } });
  assert.doesNotThrow(() => requireSameOrigin(request("https://live-translate-test.onrender.com")));
  assert.throws(() => requireSameOrigin(request("https://attacker.example")), (error) => error instanceof HttpError && error.status === 403);
  process.env.APP_URL = "https://lyssna.example.se";
  assert.doesNotThrow(() => requireSameOrigin(request("https://lyssna.example.se")));
  assert.throws(() => requireSameOrigin(request("https://live-translate-test.onrender.com")), (error) => error instanceof HttpError && error.status === 403);
});

test("rate limits block excess attempts and recover after the window", () => {
  const id = `unit-${Math.random()}`;
  assert.equal(takeRateLimit(id, 2, 1000, 100), true);
  assert.equal(takeRateLimit(id, 2, 1000, 100), true);
  assert.equal(takeRateLimit(id, 2, 1000, 100), false);
  assert.equal(takeRateLimit(id, 2, 1000, 1100), true);
});

test("a shared venue IP can admit 200 listeners without hitting the join limit", () => {
  const id = `venue-${Math.random()}`;
  for (let i = 0; i < 200; i++) assert.equal(takeRateLimit(id, 600, 60_000), true);
});
