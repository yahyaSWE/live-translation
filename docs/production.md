# Produktionsdrift

Mål: en sändare, en svensk översättningsström och högst 200 samtidiga lyssnare. Kapaciteten måste verifieras mot det faktiska LiveKit-projektet innan ett skarpt arrangemang.

## Konton och miljövariabler

Ange följande på servern. Använd Secret Manager eller hostingens motsvarande hemlighetshantering för nycklar och lösenord.

| Variabel | Innehåll |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API-nyckel med åtkomst till `gemini-3.5-live-translate-preview` |
| `LIVEKIT_URL` | Projektets `wss://…livekit.cloud`-adress |
| `LIVEKIT_API_KEY` | LiveKit API-nyckel |
| `LIVEKIT_API_SECRET` | LiveKit API-hemlighet |
| `BROADCAST_PASSWORD` | Unikt adminlösenord, minst 12 tecken |
| `AUTH_SECRET` | Slumpad sessionsnyckel, minst 32 tecken |
| `APP_URL` | Sidans publika HTTPS-origin, exempelvis `https://lyssna.example.se` |

Ingen av dessa variabler ska heta `NEXT_PUBLIC_…`. `.env.local` är ignorerad av Git och Docker. `npm run setup` skapar filen lokalt med slumpade adminuppgifter utan att skriva hemligheterna till terminalen. Befintliga filer skrivs aldrig över. Lägg inte API-nycklar i chatten.

LiveKit måste tillåta minst **202 samtidiga deltagare**: 200 lyssnare, sändaren och boten. Gratisplanens 100 samtidiga deltagare räcker inte. Kontrollera projektets aktuella kvoter och inkludera deltagarminuter och trafik i kostnadsbudgeten. Andra rum i samma projekt delar projektets kvoter.

## Hosting

Har du redan ett Render-konto finns ett färdigt `render.yaml` och en [stegvis Render-guide](render.md). På Renders standarddomän använder appen automatiskt `RENDER_EXTERNAL_URL`; `APP_URL` behövs när du använder egen domän.

Kör Docker-imagen på en server med stöd för långlivade utgående WebSocket- och WebRTC-anslutningar och kontinuerligt tilldelad CPU. Dockerfilen kör den byggda appen som användaren `node`, utan API-nycklar i bilden. Hälsokontroll: `GET /api/health`.

Google Cloud Run är ett alternativ. Börja med en instans, 1 vCPU och 1 GiB RAM och mät under belastningstestet. Detta är startvärden, inte en verifierad kapacitetsgaranti. Ställ in:

- Exakt en aktiv appinstans: minimum 1, maximum 1; ingen trafikdelning mellan revisioner.
- Instansbaserad fakturering/CPU även mellan HTTP-anrop (`--no-cpu-throttling`).
- HTTP-concurrency 250 som startvärde.
- HTTPS, publik åtkomst till lyssnarsidan och korrekt `APP_URL`.
- Secret Manager-bindningar för hemligheterna.
- Startup/liveness mot `/api/health` och loggning av fel samt larm på minne och CPU.

En instans som hålls varm kostar även när ingen sändning pågår. Gör inte en ny driftsättning under pågående sändning. Nya revisioner kan tillfälligt överlappa; appen har ingen distribuerad låsning.

## Livscykel och begränsningar

Sessionsstatus och inloggningsbegränsningar ligger i serverns minne. En processomstart avslutar därför appens aktiva session. Administratören behöver förbereda en ny sändning; nästa skapande städar bara övergivna LiveKit-rum märkta av denna app. Den publika adressen ändras inte. Kör appen i ett eget LiveKit-projekt så att den inte delar rum med andra installationer.

Sändarsidan skickar en heartbeat var tionde sekund. Utan heartbeat markeras sändningen som avbruten efter 45 sekunder och städas vid nästa kontroll (inom cirka 55 sekunder totalt). Håll sändarsidan öppen och enheten vaken. Maximal sändningstid är fyra timmar; planera en ny session för längre arrangemang. Att lämna sändarsidan avslutar sessionen efter timeout även om adminfliken fortfarande är öppen.

Översättningen hålls igång tills sessionen avslutas. Lyssnare kan inte starta eller stoppa fakturerbara Gemini-sessioner. Gemini försöker återansluta med begränsad backoff; admin-heartbeat försöker återskapa en brygga som har stängts. Lyssnarnas WebRTC-anslutning använder LiveKits återanslutning och erbjuder ett manuellt nytt försök om den bryts helt.

En admininloggning gäller i åtta timmar och använder en signerad HttpOnly-cookie, Secure i produktion och SameSite Strict. Ett byte av lösenord eller AUTH_SECRET återkallar befintliga cookies. Använd samma hemligheter under en planerad körning. Skydda proxygränsen så att klienter inte kan förfalska den `X-Forwarded-For` som används för inloggningsbegränsning. Publik tokenutgivning tillåter 600 anrop/minut per IP för att klara 200 besökare bakom samma nätverk. Den ersätter inte skydd mot stora överbelastningsangrepp hos hosting/CDN.

Detta upplägg har ingen automatisk failover eller återställning av en pågående sändning efter en serverkrasch. För det behövs extern sessionslagring, distribuerat ägarskap och separat hantering av översättningsarbetaren.

## Kontroller före publicering

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Webbläsartesterna använder testuppgifter och tomma leverantörsnycklar på port 3100. De anropar inga riktiga Gemini- eller LiveKit-tjänster. Enhetstestet med 200 samtidiga anrop verifierar att bryggan startas en gång; det är inte ett ljudbelastningstest.

Starta därefter en verklig sändning från `/admin`, prata arabiska och lyssna från en annan enhet med hörlurar. Kontrollera svensk audio/textning, mikrofonpaus, återanslutning, slut på session och Safari på iPhone samt Chrome på Android. Mikrofon och uppspelning kräver webbläsarens tillstånd; den extra knappen ”Aktivera ljudet” visas om automatisk uppspelning blockeras.

## Belastningstest med riktig media

Testskriptet använder 200 riktiga LiveKit-anslutningar och kontrollerar mottagna ljudramar. Det använder riktiga kvoter och trafik. Kör från en separat maskin med tillräckligt minne, med sändaren igång och talande. Börja med 10, fortsätt med 50 och sedan 200. PowerShell:

```powershell
$env:LOAD_TEST_URL = 'https://din-publika-adress'
$env:LOAD_TEST_LISTENERS = '200'
$env:LOAD_TEST_SECONDS = '60'
npm run test:load
```

Resultatet ska visa 200 anslutna, 200 mottagare av ljud och inga oväntade avbrott. Mät anslutningstid, faktisk fördröjning på en telefon samt CPU/minne på appservern och lastgeneratorn. Ett test med 60 sekunder är en första kontroll; kör också ett längre prov i samma längd som det planerade arrangemanget. Testa ett scenario där många lyssnare ansluter samtidigt och ett där nätverket bryts och återkommer.

## Leverantörsdokumentation

- [Gemini Live Translate](https://ai.google.dev/gemini-api/docs/live-api/live-translate)
- [LiveKit-kvoter](https://docs.livekit.io/deploy/admin/quotas-and-limits/)
- [LiveKit-priser](https://livekit.com/pricing)
- [Cloud Run: CPU-allokering](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
