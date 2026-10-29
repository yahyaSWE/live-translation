"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ClientApiError, errorMessage } from "@/lib/client-api";
import type { AdminStatus } from "@/lib/public-types";

export default function AdminConsole({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(authenticated);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [title, setTitle] = useState("Direktöversättning");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const data = await api<AdminStatus>("/api/admin/status", { signal: controller.signal });
        if (!controller.signal.aborted) { setStatus(data); setError(null); }
      } catch (cause) {
        if (!controller.signal.aborted) {
          if (cause instanceof ClientApiError && cause.status === 401) setSignedIn(false);
          setError(errorMessage(cause));
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 10_000);
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [signedIn]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await api("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }); setPassword(""); setSignedIn(true); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const session = await api<{ broadcastUrl: string }>("/api/sessions", { method: "POST", body: JSON.stringify({ title }) });
      router.push(session.broadcastUrl);
    } catch (cause) { setError(errorMessage(cause)); setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError(null);
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); setStatus(null); setSignedIn(false); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  const ready = status && Object.values(status.configuration).every(Boolean);
  return <main className="page admin-page"><div className="admin-shell">
    <header className="site-header"><Link href="/" className="wordmark">Live <em>Translate</em></Link><Link href="/">Lyssnarsidan</Link></header>
    <section className="admin-main">
      <h1 className="display display-lg">{signedIn ? <>Din <em>sändning.</em></> : <>Logga in<br /><em>som administratör.</em></>}</h1>
      <p className="body">{signedIn ? "Sänd på arabiska. Dina lyssnare hör svenska." : "Här startar och hanterar du direktöversättningen."}</p>
      {error && <p className="error-message" role="alert">{error}</p>}
      {!signedIn ? <form onSubmit={(e) => void login(e)} className="admin-form">
        <label className="field-label" htmlFor="admin-password">Lösenord</label>
        <input id="admin-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" disabled={busy} maxLength={1024} />
        <button className="btn btn-dark wide" disabled={busy}>{busy ? "Loggar in…" : "Logga in"}</button>
      </form> : <>
        {!status ? <p role="status">Hämtar inställningar…</p> : <>
          <section className="admin-section">
            <h2 className="section-title">Anslutningar</h2>
            <ul className="setup-list">
              {([["gemini", "Gemini API"], ["livekit", "LiveKit"], ["password", "Adminlösenord"], ["authSecret", "Sessionsnyckel"]] as const).map(([key, label]) => <li key={key}><span>{label}</span><span className={status.configuration[key] ? "setup-ready" : "setup-missing"}>{status.configuration[key] ? "Konfigurerad" : "Saknas"}</span></li>)}
            </ul>
            {!ready && <p className="body">Fyll i de saknade uppgifterna i serverns miljövariabler. Starta sedan om appen.</p>}
            <p className="fine-print">Status visar att uppgifterna finns. Anslutningen verifieras när du skapar och startar en sändning.</p>
          </section>
          {status.session ? <section className="admin-section">
            <h2 className="section-title">Aktuell sändning</h2><p className="active-title">{status.session.title}</p>
            <Link href={`/session/${status.session.sessionId}/broadcast`} className="btn btn-dark wide">Öppna sändningen</Link>
          </section> : <form onSubmit={(e) => void create(e)} className="admin-form admin-section">
            <h2 className="section-title">Förbered en sändning</h2>
            <label className="field-label" htmlFor="broadcast-title">Namn på sändningen</label>
            <input id="broadcast-title" className="input-field" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
            <p className="body">Svenska väljs automatiskt för lyssnarna. Mikrofonen startar först när du väljer att gå live.</p>
            <button className="btn btn-dark wide" disabled={busy || !ready}>{busy ? "Förbereder…" : "Förbered sändning"}</button>
          </form>}
        </>}
        <button className="btn btn-outline wide" onClick={() => void logout()} disabled={busy}>Logga ut</button>
      </>}
    </section>
    <footer className="site-footer"><span>Arabiska till svenska</span><span>Admin</span></footer>
  </div></main>;
}
