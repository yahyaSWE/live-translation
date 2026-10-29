import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { connectGemini } from "../src/lib/gemini-connection";
import { ServiceError } from "../src/lib/service-error";

async function provider(t: TestContext, handle: (socket: WebSocket) => void, rejectHandshake?: number) {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1", ...(rejectHandshake ? { verifyClient: (_info, done) => done(false, rejectHandshake, "Denied") } : {}) });
  await once(server, "listening");
  server.on("connection", handle);
  t.after(async () => {
    for (const client of server.clients) client.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    apiKey: "test-only-not-a-real-key",
    targetLanguage: "sv",
    signal: new AbortController().signal,
    onSocket: () => {}, onReady: () => {}, onMessage: () => {}, onClose: () => {},
    createSocket: (_url: string, options: WebSocket.ClientOptions) => new WebSocket(`ws://127.0.0.1:${address.port}`, options),
  };
}

test("raw WebSocket setup enables translated captions and suppresses target-language echo", async (t) => {
  let accepted = false;
  const options = await provider(t, (socket) => socket.once("message", (raw) => {
    const { setup } = JSON.parse(raw.toString());
    // Regression: the wire API rejects transcription nested in generationConfig.
    if ("outputAudioTranscription" in setup.generationConfig) {
      socket.close(1007, 'Unknown name "outputAudioTranscription" at setup.generation_config');
      return;
    }
    assert.deepEqual(setup.outputAudioTranscription, {});
    assert.equal(setup.generationConfig.translationConfig.targetLanguageCode, "sv");
    assert.equal(setup.generationConfig.translationConfig.echoTargetLanguage, false);
    assert.equal(setup.model, "models/gemini-3.5-live-translate-preview");
    accepted = true;
    socket.send(JSON.stringify({ setupComplete: {} }));
  }));
  await connectGemini(options);
  assert.equal(accepted, true);
});

test("resume setup normalizes the model resource and forwards post-setup messages", async (t) => {
  let received = false;
  const options = await provider(t, (socket) => socket.once("message", (raw) => {
    const { setup } = JSON.parse(raw.toString());
    assert.equal(setup.model, "models/gemini-3.5-live-translate-preview");
    assert.equal(setup.sessionResumption.handle, "test-resumption-handle");
    socket.send(JSON.stringify({ setupComplete: {} }));
    socket.send(JSON.stringify({ serverContent: { outputTranscription: { text: "test text" } } }));
  }));
  let delivered = () => {};
  const messageReceived = new Promise<void>((resolve) => { delivered = resolve; });
  await connectGemini({
    ...options, model: "models/gemini-3.5-live-translate-preview", resumeHandle: "test-resumption-handle",
    onMessage: (message) => {
      received = Boolean(message.serverContent?.outputTranscription?.text);
      delivered();
    },
  });
  await messageReceived;
  assert.equal(received, true);
});

test("a 1007 rejection preserves the setup failure code instead of a generic startup error", async (t) => {
  const options = await provider(t, (socket) => socket.once("message", () => socket.close(1007, 'Invalid JSON payload. Unknown name "badField"')));
  await assert.rejects(connectGemini(options), (error) => error instanceof ServiceError && error.code === "GEMINI_SETUP_INVALID" && error.stage === "gemini.setup");
});

test("provider quota errors are surfaced immediately with their own code", async (t) => {
  const options = await provider(t, (socket) => socket.once("message", () => socket.send(JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded" } }))));
  await assert.rejects(connectGemini(options), (error) => error instanceof ServiceError && error.code === "GEMINI_QUOTA");
});

test("HTTP handshake authorization failure is distinguished from a timeout", async (t) => {
  const options = await provider(t, () => {}, 403);
  await assert.rejects(connectGemini(options), (error) => error instanceof ServiceError && error.code === "GEMINI_AUTH");
});

test("a stalled provider times out and releases its socket", async (t) => {
  const options = await provider(t, () => {});
  await assert.rejects(connectGemini({ ...options, setupTimeoutMs: 50 }), (error) => error instanceof ServiceError && error.code === "GEMINI_TIMEOUT");
});

test("stopping the bridge aborts an in-flight handshake without waiting for its timeout", async (t) => {
  const controller = new AbortController();
  const options = await provider(t, (socket) => socket.once("message", () => controller.abort()));
  await assert.rejects(connectGemini({ ...options, signal: controller.signal }), /Translation stopped/);
});
