# Khutbah Live

Liveöversättning av fredagens khutbah från arabiska till svenska med Gemini Live Translate och LiveKit. En sändare, en gemensam svensk översättningsström och en publik lyssnarsida utan besökarinloggning. Målet är upp till 200 lyssnare; verklig mediakapacitet måste verifieras med det avsedda LiveKit-projektet.

## Kom igång lokalt

Node.js 22 eller senare krävs.

```bash
npm ci
npm run setup
```

Öppna `.env.local` och fyll i:

```env
GEMINI_API_KEY=din-gemini-nyckel
LIVEKIT_URL=wss://ditt-projekt.livekit.cloud
LIVEKIT_API_KEY=din-livekit-nyckel
LIVEKIT_API_SECRET=din-livekit-hemlighet
```

Setup skapar även `BROADCAST_PASSWORD` och `AUTH_SECRET` slumpmässigt. Adminlösenordet finns bara i din lokala fil. Setup skriver aldrig över en befintlig fil. Nycklarna stannar på servern och ska inte klistras in i chatten eller versionshanteras.

```bash
npm run dev
```

- Lyssnarsida: [http://localhost:3000](http://localhost:3000)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

Logga in med `BROADCAST_PASSWORD`. Förbered sändningen, välj mikrofon och tryck på **Slå på mikrofonen och gå live**. Dela den publika rotadressen eller QR-koden. Lyssnaren trycker **Lyssna på svenska**. Språket väljs automatiskt. Om webbläsaren blockerar uppspelning visas **Aktivera ljudet**.

Du kan också köra en egen LiveKit-server. `ws://localhost:7880` tillåts under lokal utveckling; produktion kräver `wss://`.

## Hur det fungerar

```text
Sändarens mikrofon
      ↓
LiveKit-rum ──→ en serverbrygga ──→ Gemini Live Translate
      ↑                                     ↓
      └──────── svenskt ljud + textning ─────┘
      ↓
Alla lyssnare delar samma svenska översättning
```

Sändningen hålls i gång av adminsidans heartbeat. En lyssnare kan inte skapa eller stänga en Gemini-session. Dubbla samtidiga startanrop delar samma pågående start. Listener count hämtas från LiveKit i stället för att räknas upp och ned av webbläsaren. Rummet begränsas till 202 deltagare: 200 lyssnare, sändaren och översättningsboten.

Källspråket identifieras automatiskt. Bryggan skickar 16 kHz mono PCM och publicerar Geminis 24 kHz ljud. Svenska är det enda aktiverade målspråket i denna version. Modellen är `gemini-3.5-live-translate-preview`; systemprompter stöds inte av denna översättningsmodell.

## Kontroller

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

`npm start` startar det fristående produktionsbygget och kopierar dess statiska filer på plats. Docker använder samma fristående server. Webbläsartester använder isolerade testuppgifter på port 3100 och anropar inga riktiga leverantörstjänster.

## Publicering

Läs [produktionsguiden](docs/production.md) för konton, hemligheter, hosting, kapacitetsprov och kända begränsningar.

För Render finns en färdig Blueprint i `render.yaml` och en [stegvis publiceringsguide](docs/render.md).

Appen kräver **en enda instans med kontinuerligt tilldelad CPU**. Sessionsstatus ligger i minnet, så en serveromstart kräver att admin startar en ny session. Automatisk failover ingår inte. Den publika adressen kan fortsätta användas efter omstarten. Stängda sändarsidor städas efter cirka 45–55 sekunder. Sändningar avslutas efter högst fyra timmar.

## Projektstruktur

```text
src/app/                         publik sida, admin och API-rutter
src/components/Listener.tsx       anslutning, volym och svensk textning
src/components/AdminConsole.tsx  inloggning och konfigurationsstatus
src/components/BroadcastConsole.tsx mikrofon, sändning och inbjudan
src/lib/security.ts              signerade admincookies och anropsbegränsning
src/lib/translation-session-manager.ts gemensam sändningslivscykel
src/lib/translation-bridge.ts    LiveKit ↔ Gemini, ljud och textning
scripts/load-listeners.mjs       belastningsprov med riktiga ljudmottagare
tests/                          säkerhets-, samtidighets- och webbläsartester
```

Äldre dokument i `docs/` beskriver originaldemot och kan avvika från denna version. `docs/production.md` beskriver det aktuella driftupplägget.

## Licens

Ursprunglig kod copyright 2026 Google LLC, Apache License 2.0; se [LICENSE](LICENSE). Ursprungligt övrigt material är CC-BY 4.0. Detta är inte en officiell Google-produkt. Ingen garanti lämnas; se licenserna.
