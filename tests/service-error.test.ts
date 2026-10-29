import { test } from "node:test";
import assert from "node:assert/strict";
import { geminiError, safeErrorDetails, ServiceError } from "../src/lib/service-error";
import { apiError } from "../src/lib/http";

test("diagnostics redact raw and encoded credentials, access tokens and JWTs", () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-secret-key/with-special-characters";
  try {
    const raw = `failure key=${process.env.GEMINI_API_KEY} encoded=${encodeURIComponent(process.env.GEMINI_API_KEY)} https://example.test/ws?key=another-secret&token=access-secret Bearer bearer-secret eyJhbGciOiJIUzI1NiJ9.e30.signature\nforged-log`;
    const safe = safeErrorDetails(new Error(raw));
    for (const secret of [process.env.GEMINI_API_KEY, encodeURIComponent(process.env.GEMINI_API_KEY), "another-secret", "access-secret", "bearer-secret", "eyJhbGciOiJIUzI1NiJ9", "\n"]) assert.equal(safe.includes(secret), false);
    assert.ok(safe.includes("[REDACTED]"));
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test("upstream details stay in sanitized logs and fixed error messages reach the browser", async () => {
  const logs: unknown[][] = [];
  const original = console.error;
  console.error = (...items) => { logs.push(items); };
  try {
    const response = apiError(new ServiceError("GEMINI_SETUP_INVALID", "gemini.setup", new Error("Unknown name outputAudioTranscription at setup.generation_config")));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.code, "GEMINI_SETUP_INVALID");
    assert.ok(body.error.includes("GEMINI_SETUP_INVALID"));
    assert.equal(body.error.includes("generation_config"), false);
    assert.ok(JSON.stringify(logs).includes("generation_config"));
  } finally { console.error = original; }
});

test("provider failure classification separates quota, model access and configuration", () => {
  assert.equal(geminiError(new Error("Quota exceeded"), 429).code, "GEMINI_QUOTA");
  assert.equal(geminiError(new Error("API key invalid"), 400).code, "GEMINI_AUTH");
  assert.equal(geminiError(new Error("Model not found"), 404).code, "GEMINI_MODEL");
  assert.equal(geminiError(new Error("Unknown name in JSON"), 1007).code, "GEMINI_SETUP_INVALID");
});
