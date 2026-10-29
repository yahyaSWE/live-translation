"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LiveKitRoom, useConnectionState, useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import SessionQRCode from "./SessionQRCode";
import { api, ClientApiError, errorMessage } from "@/lib/client-api";
import type { LiveStatus } from "@/lib/public-types";
import SiteBrand from "./SiteBrand";

const subscribeOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

function Controls({ sessionId, title, onEnding }: { sessionId: string; title: string; onEnding: (value: boolean) => void }) {
  const router = useRouter();
  const room = useRoomContext();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [listeners, setListeners] = useState<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState("default");
  const [copied, setCopied] = useState(false);
  const url = useSyncExternalStore(subscribeOrigin, getOrigin, getServerOrigin);
  const broadcasting = isMicrophoneEnabled && connection === ConnectionState.Connected;
  const broadcastingRef = useRef(broadcasting);
  const heartbeatRef = useRef<(() => Promise<void>) | null>(null);
  const endingRef = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  useEffect(() => {
    broadcastingRef.current = broadcasting;
    void heartbeatRef.current?.();
  }, [broadcasting]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    const heartbeat = async () => {
      if (inFlight || cancelled || endingRef.current) return;
      inFlight = true;
      const sentBroadcasting = broadcastingRef.current;
      try {
        const data = await api<{ live: LiveStatus }>(`/api/sessions/${sessionId}`, { method: "PATCH", body: JSON.stringify({ broadcasting: sentBroadcasting }), signal: controller.signal });
        if (!cancelled) { setLive(data.live); setError(null); }
      } catch (cause) {
        if (!cancelled) {
          setError(errorMessage(cause));
          if (cause instanceof ClientApiError && (cause.status === 401 || cause.status === 404)) {
            await localParticipant.setMicrophoneEnabled(false).catch(() => {});
          }
        }
      } finally {
        inFlight = false;
        if (!cancelled && sentBroadcasting !== broadcastingRef.current) void heartbeat();
      }
    };
    heartbeatRef.current = heartbeat;
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 10_000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); heartbeatRef.current = null; };
  }, [sessionId, localParticipant]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await api<{ listenerCount: number }>(`/api/translate/status?sessionId=${encodeURIComponent(sessionId)}`, { signal: controller.signal });
        if (!controller.signal.aborted) setListeners(data.listenerCount);
      } catch { if (!controller.signal.aborted) setListeners(null); }
      if (!controller.signal.aborted) timer = setTimeout(refresh, 10_000);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [sessionId]);

  useEffect(() => {
    if (!navigator.mediaDevices) return;
    let cancelled = false;
    const refresh = async () => {
      try { const all = await navigator.mediaDevices.enumerateDevices(); if (!cancelled) setDevices(all.filter((d) => d.kind === "audioinput")); }
      catch { /* The microphone action provides the permission error. */ }
    };
    void refresh();
    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => { cancelled = true; navigator.mediaDevices.removeEventListener("devicechange", refresh); };
  }, [isMicrophoneEnabled]);

  useEffect(() => {
    if (!broadcasting || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) await next.release(); else lock = next;
      } catch { /* Wake Lock is optional. */ }
    };
    const visible = () => { if (document.visibilityState === "visible" && (!lock || lock.released)) void acquire(); };
    void acquire();
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", visible); void lock?.release(); };
  }, [broadcasting]);

  async function toggleMicrophone() {
    setBusy(true); setError(null);
    try { await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled, { echoCancellation: true, noiseSuppression: true, autoGainControl: true }); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function changeDevice(value: string) {
    setBusy(true); setError(null);
    try { await room.switchActiveDevice("audioinput", value); setDevice(value); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function end() {
    setEnding(true); setError(null); endingRef.current = true;
    onEnding(true);
    try {
      await api(`/api/sessions/${sessionId}`, { method: "DELETE" });
      await room.disconnect();
      router.push("/admin");
    } catch (cause) { onEnding(false); endingRef.current = false; setEnding(false); setError(errorMessage(cause)); }
  }

  const connected = connection === ConnectionState.Connected;
  return <div className="admin-shell">
    <header className="site-header"><SiteBrand href="/admin" /><a href="/" target="_blank" rel="noreferrer">Lyssnarsidan</a></header>
    <section className="admin-main">
      <h1 className="display display-lg">{title}</h1>
      <div className="broadcast-status" role="status"><span className={`live-dot ${live?.state === "live" && broadcasting ? "is-live" : ""}`} aria-hidden="true" /><span>{!connected ? "Återansluter till ljudservern…" : !isMicrophoneEnabled ? "Mikrofonen är av. Du sänder inte." : live?.state === "live" ? "Du är live. Översättningen till svenska är igång." : "Mikrofonen är på. Översättningen startar…"}</span></div>
      {error && <p className="error-message" role="alert">{error}</p>}
      <section className="admin-section">
        <h2 className="section-title">Mikrofon</h2>
        <label className="field-label" htmlFor="microphone-device">Ljudkälla</label>
        <select id="microphone-device" value={device} onChange={(e) => void changeDevice(e.target.value)} className="select-field" disabled={busy || !connected || ending}>
          <option value="default">Standardmikrofon</option>
          {devices.filter((d) => d.deviceId !== "default").map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${i + 1}`}</option>)}
        </select>
        <button className={`btn ${isMicrophoneEnabled ? "btn-outline" : "btn-dark"} wide microphone-button`} onClick={() => void toggleMicrophone()} disabled={busy || !connected || ending}>{busy ? "Vänta…" : isMicrophoneEnabled ? "Pausa mikrofonen" : "Slå på mikrofonen och gå live"}</button>
        <p className="fine-print">Predikan översätts från arabiska till svenska. Håll sidan öppen och lyssnarnas högtalare borta från mikrofonen.</p>
      </section>
      <div className="listener-count"><span>Anslutna lyssnare</span><span>{listeners ?? "–"} <span className="capacity-label">/ 200</span></span></div>
      <section className="admin-section share-section">
        <div><h2 className="section-title">Bjud in lyssnarna</h2><p className="body">Samma adress används vid varje sändning.</p>
          <p className="share-url">{url || "Hämtar adress…"}</p>
          <button className="btn btn-outline" onClick={async () => {
            try { await navigator.clipboard.writeText(url); setCopied(true); if (copyTimer.current) clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(false), 2500); }
            catch { setError("Kunde inte kopiera adressen. Markera och kopiera länken ovan."); }
          }}>{copied ? "Adressen är kopierad" : "Kopiera adress"}</button>
        </div>
        {url && <div aria-label="QR-kod till lyssnarsidan"><SessionQRCode url={url} size={132} /></div>}
      </section>
      <section className="admin-section end-section">
        {confirmEnd ? <><p>Avsluta sändningen för alla lyssnare?</p><div className="button-row"><button className="btn-danger" disabled={ending} onClick={() => void end()}>{ending ? "Avslutar…" : "Ja, avsluta sändningen"}</button><button className="btn btn-outline" disabled={ending} onClick={() => setConfirmEnd(false)}>Fortsätt sända</button></div></> : <button className="btn-danger wide" disabled={busy} onClick={() => setConfirmEnd(true)}>Avsluta sändningen</button>}
      </section>
    </section>
    <footer className="site-footer"><span>Khutbah · Arabiska till svenska</span><Link href="/admin">Till admin</Link></footer>
  </div>;
}

export default function BroadcastConsole({ sessionId, title }: { sessionId: string; title: string }) {
  const [credentials, setCredentials] = useState<{ token: string; serverUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ended = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void api<{ token: string; serverUrl: string }>("/api/token", { method: "POST", body: JSON.stringify({ role: "organizer", sessionId }), signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) { setCredentials(data); setError(null); } })
      .catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [sessionId, attempt]);

  if (error) return <main className="page"><div className="admin-shell"><h1 className="display display-md">Anslutningen bröts</h1><p className="error-message" role="alert">{error}</p><button className="btn btn-dark wide" onClick={() => { setCredentials(null); setError(null); setAttempt((n) => n + 1); }}>Försök igen</button><Link href="/admin" className="btn btn-outline wide">Till admin</Link></div></main>;
  if (!credentials) return <main className="page"><p role="status">Ansluter till sändningen…</p></main>;
  return <main className="page admin-page"><LiveKitRoom key={attempt} token={credentials.token} serverUrl={credentials.serverUrl} audio={false} video={false} connectOptions={{ autoSubscribe: false }} onError={() => setError("Kunde inte ansluta till ljudservern. Kontrollera anslutningen och försök igen.")} onDisconnected={() => { if (!ended.current) setError("Ljudservern kopplades från. Anslut igen för att fortsätta sända."); }}>
    <Controls sessionId={sessionId} title={title} onEnding={(value) => { ended.current = value; }} />
  </LiveKitRoom></main>;
}
