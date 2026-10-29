import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const file = new URL("../.env.local", import.meta.url);
if (existsSync(file)) {
  console.log(".env.local finns redan och har inte ändrats.");
} else {
  const template = readFileSync(new URL("../.env.example", import.meta.url), "utf8")
    .replace(/^BROADCAST_PASSWORD=$/m, `BROADCAST_PASSWORD=${randomBytes(18).toString("base64url")}`)
    .replace(/^AUTH_SECRET=$/m, `AUTH_SECRET=${randomBytes(32).toString("hex")}`);
  writeFileSync(file, template, { flag: "wx", mode: 0o600 });
  console.log(".env.local skapad med slumpat adminlösenord och sessionsnyckel. Lägg in Gemini- och LiveKit-uppgifterna i filen. Inga hemligheter skrivs till terminalen.");
}
