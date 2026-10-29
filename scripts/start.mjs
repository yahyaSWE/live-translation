import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
if (existsSync(new URL(".env.local", root))) process.loadEnvFile(fileURLToPath(new URL(".env.local", root)));
const output = new URL(".next/standalone/", root);
if (!existsSync(new URL("server.js", output))) throw new Error("Produktionsbygget saknas. Kör npm run build först.");
cpSync(new URL(".next/static/", root), new URL(".next/static/", output), { recursive: true });
cpSync(new URL("public/", root), new URL("public/", output), { recursive: true });
const server = spawn(process.execPath, [fileURLToPath(new URL("server.js", output))], {
  stdio: "inherit", env: { ...process.env, HOSTNAME: process.env.HOSTNAME || "0.0.0.0", PORT: process.env.PORT || "3000" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => { process.exitCode = code ?? 1; });
