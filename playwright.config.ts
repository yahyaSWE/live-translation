import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: "http://localhost:3100", browserName: "chromium", reducedMotion: "reduce", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: false,
    env: { PORT: "3100", HOSTNAME: "127.0.0.1", AUTH_SECRET: "playwright-only-secret-at-least-32-characters", BROADCAST_PASSWORD: "playwright-admin-password", GEMINI_API_KEY: "", LIVEKIT_API_KEY: "", LIVEKIT_API_SECRET: "", LIVEKIT_URL: "", APP_URL: "http://localhost:3100" },
  },
});
