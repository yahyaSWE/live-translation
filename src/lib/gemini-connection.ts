import WebSocket, { type ClientOptions } from "ws";
import { geminiError, logServiceError, ServiceError } from "./service-error";

type GeminiContent = {
  modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
  outputTranscription?: { text?: string };
  turnComplete?: boolean;
};

export type GeminiMessage = {
  setupComplete?: object;
  error?: { code?: number; message?: string; status?: string };
  sessionResumptionUpdate?: { resumable?: boolean; newHandle?: string };
  goAway?: object;
  serverContent?: GeminiContent;
};

type Options = {
  apiKey: string;
  targetLanguage: string;
  model?: string;
  resumeHandle?: string;
  signal: AbortSignal;
  onSocket: (socket: WebSocket) => void;
  onReady: (socket: WebSocket) => void;
  onMessage: (message: GeminiMessage, socket: WebSocket) => void;
  onClose: (socket: WebSocket) => void;
  // Dependency injection for local protocol tests; never read from request input.
  createSocket?: (url: string, options: ClientOptions) => WebSocket;
  setupTimeoutMs?: number;
};

export function connectGemini(options: Options): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(options.apiKey)}`;
    if (options.signal.aborted) { reject(new Error("Translation stopped")); return; }
    const ws = (options.createSocket ?? ((url, config) => new WebSocket(url, config)))(url, { handshakeTimeout: 15_000, maxPayload: 4 * 1024 * 1024 });
    options.onSocket(ws);
    let ready = false;
    let failed = false;
    const timeout = setTimeout(() => fail(new ServiceError("GEMINI_TIMEOUT", "gemini.setup")), options.setupTimeoutMs ?? 15_000);
    const fail = (error: Error) => {
      if (failed) return;
      failed = true;
      clearTimeout(timeout);
      if (ready && error instanceof ServiceError) logServiceError(error);
      reject(error);
      ws.terminate();
    };
    const abort = () => fail(new Error("Translation stopped"));
    options.signal.addEventListener("abort", abort, { once: true });
    ws.on("open", () => {
      if (options.signal.aborted || failed) { ws.terminate(); return; }
      // Transcription is a BidiGenerateContentSetup field, not GenerationConfig.
      // The raw WebSocket schema differs from examples in the translation guide.
      // Source: googleapis/googleapis google/ai/generativelanguage/v1beta/generative_service.proto.
      ws.send(JSON.stringify({ setup: {
        model: `models/${(options.model || "gemini-3.5-live-translate-preview").replace(/^models\//, "")}`,
        outputAudioTranscription: {},
        generationConfig: {
          responseModalities: ["AUDIO"],
          // Suppress speech already in Swedish so captured playback is not echoed.
          // Physical speaker-to-microphone feedback still requires headphones or separation.
          translationConfig: { targetLanguageCode: options.targetLanguage, echoTargetLanguage: false },
        },
        sessionResumption: options.resumeHandle ? { handle: options.resumeHandle } : {},
      } }));
    });
    ws.on("message", (raw) => {
      if (failed || options.signal.aborted) return;
      let message: GeminiMessage;
      try { message = JSON.parse(raw.toString()); }
      catch { return; }
      if (!message || typeof message !== "object") return;
      if (message.error) {
        fail(geminiError(new Error(message.error.message || message.error.status || "Gemini rejected the connection"), message.error.code));
        return;
      }
      if (message.setupComplete && !ready) {
        clearTimeout(timeout);
        ready = true;
        options.onReady(ws);
        resolve();
        return;
      }
      if (ready) options.onMessage(message, ws);
    });
    ws.on("unexpected-response", (_request, response) => {
      response.resume();
      fail(geminiError(new Error(`Gemini WebSocket handshake: HTTP ${response.statusCode}`), response.statusCode));
    });
    ws.on("error", (error) => {
      if (!ready) fail(geminiError(error));
      else ws.terminate();
    });
    ws.on("close", (code, reason) => {
      clearTimeout(timeout);
      options.signal.removeEventListener("abort", abort);
      if (!ready && !failed) {
        failed = true;
        reject(geminiError(new Error(`Gemini closed: ${code} ${reason.toString()}`), code));
      }
      options.onClose(ws);
    });
  });
}
