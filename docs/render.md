# Publicera på Render

Projektets `render.yaml` förbereder en Docker Web Service i Frankfurt med en instans och planen `0.5c-512mb` (0,5 CPU, 512 MB RAM). Kontrollera kostnaden i Render innan du godkänner skapandet. Den 29 oktober 2026 kostar den instansen 7 USD/månad, med eventuella andra Render-avgifter samt Gemini och LiveKit utöver detta. Använd den för de första funktionstesterna med ett fåtal lyssnare; kapaciteten för 200 lyssnare är inte verifierad.

Följ minne, CPU och ljudavbrott under provdriften. Vid minnesbrist, omstarter eller för hög CPU kan du höja tjänsten till `1c-2g` (1 CPU, 2 GB RAM), som för närvarande kostar 25 USD/månad. Kör skalningsändringar mellan sändningar. Gratisplanen kan användas för en enkel förhandsvisning men har viloläge och kan startas om av Render.

## 1. Lägg den ändrade koden i ditt eget GitHub-repo

Den ursprungliga Git-remoten kan peka på `google-gemini/gemini-live-translate-livekit`. Den innehåller inte våra lokala ändringar. Skapa ett eget, gärna privat, repo och pusha den ändrade versionen dit. Render behöver åtkomst till det repot. `.env.local` ska inte följa med; den är ignorerad av både Git och Docker.

## 2. Skapa tjänsten från Blueprint

1. Öppna [Render Dashboard](https://dashboard.render.com).
2. Välj **New → Blueprint** och anslut ditt GitHub-repo.
3. Använd `render.yaml` i repots rot som Blueprint-fil.
4. Kontrollera att förslaget innehåller en Docker Web Service, en instans, Frankfurt och rätt betald compute-plan.
5. Fyll i värdena som Render frågar efter:

   | Namn | Värde |
   | --- | --- |
   | `GEMINI_API_KEY` | Din Gemini-nyckel |
   | `LIVEKIT_URL` | Projektets `wss://…livekit.cloud`-adress |
   | `LIVEKIT_API_KEY` | LiveKit API-nyckel |
   | `LIVEKIT_API_SECRET` | LiveKit API-hemlighet |
   | `BROADCAST_PASSWORD` | Ett eget adminlösenord med minst 12 tecken |

   `AUTH_SECRET` genereras automatiskt av Render. `PORT` och `NODE_ENV` är redan angivna i Blueprint-filen. Ange hemligheterna direkt i Render, aldrig i repot eller chatten.

6. Granska och skapa tjänsten. Render bygger Docker-imagen och visar sin publika HTTPS-adress när driftsättningen lyckas.

Ingen separat Build Command eller Start Command behövs för Docker: byggstegen och startkommandot finns i `Dockerfile`. Servern binder till `0.0.0.0` och läser `PORT`. Hälsokontrollen är `/api/health`.

## 3. Kontrollera och provsänd

- Besök tjänstens publika adress. Den ska visa att ingen sändning pågår.
- Öppna samma adress med `/admin` och logga in med ditt `BROADCAST_PASSWORD`.
- Kontrollera konfigurationen, förbered en sändning och slå på mikrofonen.
- Öppna rotadressen på en annan enhet, använd hörlurar och välj **Lyssna på svenska**.
- Kontrollera svenskt ljud och textning, mikrofonpaus, återanslutning samt avslut av sändningen.

Appen använder automatiskt Renders betrodda `RENDER_EXTERNAL_URL` för kontroll av webbläsarens origin. Du behöver därför inte gissa eller ange `APP_URL` vid den första publiceringen. Om du lägger till egen domän anger du `APP_URL=https://din-domän` under tjänstens **Environment** och driftsätter ändringen. Använd sedan den adressen för både admin och lyssnare.

## 4. Innan en skarp sändning

- LiveKit-projektet behöver kvot för minst 202 samtidiga deltagare: 200 lyssnare, sändaren och boten.
- Följ [produktionsguiden](production.md), inklusive belastningstest med riktiga ljudmottagare och prov på iPhone/Android. Testa först 10, sedan 50 och till sist 200 lyssnare.
- Behåll **en instans**. Appen använder sessionsstatus i processens minne.
- Automatiska koddriftsättningar är avstängda i `render.yaml`. Använd **Manual Deploy** efter att du har pushat ändringar, när ingen sändning pågår. Granska även Blueprint-ändringar utanför sändningstid.
- En omstart eller ny driftsättning kräver att admin förbereder en ny sändning. Publik adress och sparade miljövariabler finns kvar.
- Gratisplanen är avsedd för utvärdering och kan vila eller startas om. Använd den betalda tjänsten inför publik drift.

## Vanliga problem

- **Bygget kör originaldemot:** kontrollera att Render använder ditt repo och rätt commit med våra ändringar.
- **Port saknas:** kontrollera att Docker används och att `PORT` inte har ändrats till en annan fast port än serverns.
- **Inloggning nekas på egen domän:** kontrollera `APP_URL`, driftsätt ändringen och öppna exakt samma HTTPS-origin.
- **LiveKit/Gemini är markerade konfigurerade men start misslyckas:** status verifierar att uppgifterna finns; kontrollera nycklarnas giltighet, modellåtkomst, kvoter och ljudanslutningen i den verkliga driftsmiljön.

## Källor

- [Render Blueprints](https://render.com/docs/infrastructure-as-code)
- [Blueprint-fält](https://render.com/docs/blueprint-spec)
- [Renders miljövariabler](https://render.com/docs/environment-variables)
- [Priser](https://render.com/pricing)
