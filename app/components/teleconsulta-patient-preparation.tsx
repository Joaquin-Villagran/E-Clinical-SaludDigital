"use client";

import { useEffect, useRef, useState } from "react";
import { Battery, CheckCircle2, LockKeyhole, Mic, Wifi, Video } from "lucide-react";
import JitsiRoom from "@/components/telemedicine/JitsiRoom";

type Props = {
  appointmentId: string;
  roomName: string;
  displayName: string;
  email?: string | null;
  returnHref: string;
  domain?: string;
};

type CheckState = "checking" | "ok" | "error";

export default function TeleconsultaPatientPreparation({ appointmentId, roomName, displayName, email, returnHref, domain }: Props) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [connection, setConnection] = useState<CheckState>("checking");
  const [connectionMessage, setConnectionMessage] = useState("Comprobando conexión...");
  const [mediaState, setMediaState] = useState<CheckState>("checking");
  const [mediaMessage, setMediaMessage] = useState("Todavía no probaste cámara y micrófono");
  const [batteryMessage, setBatteryMessage] = useState("Comprobando batería...");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkConnection() {
      if (!navigator.onLine) {
        setConnection("error");
        setConnectionMessage("Sin conexión a Internet");
        return;
      }
      const startedAt = performance.now();
      try {
        const response = await fetch(`/api/teleconsulta/${appointmentId}`, { cache: "no-store" });
        if (!mounted) return;
        if (!response.ok && response.status !== 409) throw new Error("No responde la plataforma");
        const latency = Math.round(performance.now() - startedAt);
        setConnection("ok");
        setConnectionMessage(`Conexión disponible${latency ? ` · ${latency} ms` : ""}`);
      } catch {
        if (!mounted) return;
        setConnection("error");
        setConnectionMessage("No pudimos comprobar la conexión");
      }
    }

    function handleOnline() { void checkConnection(); }
    void checkConnection();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOnline);

    const navigatorWithBattery = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    navigatorWithBattery.getBattery?.().then((battery) => {
      if (!mounted) return;
      const percentage = Math.round(battery.level * 100);
      setBatteryMessage(battery.charging ? `${percentage}% · conectado al cargador` : `${percentage}% de batería`);
    }).catch(() => mounted && setBatteryMessage("No se pudo comprobar la batería"));

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOnline);
    };
  }, [appointmentId]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function testMedia() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play();
      }
      setMediaState("ok");
      setMediaMessage("Cámara y micrófono disponibles");
    } catch {
      setMediaState("error");
      setMediaMessage("Permití el acceso a la cámara y al micrófono para probarlos");
    }
  }

  function enterRoom() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(true);
  }

  if (ready) return <JitsiRoom appointmentId={appointmentId} roomName={roomName} displayName={displayName} email={email} returnHref={returnHref} domain={domain} />;

  const itemClass = "flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4";
  const stateIcon = (state: CheckState) => state === "ok" ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" /> : state === "error" ? <span className="mt-0.5 h-5 w-5 rounded-full bg-rose-100 text-center text-sm font-bold text-rose-700">!</span> : <span className="mt-1 h-4 w-4 animate-pulse rounded-full bg-[var(--accent)]" />;

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(14,75,78,0.12)]">
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Antes de comenzar</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Prepará tu videoconsulta</h2>
      <p className="mt-2 text-sm text-[var(--foreground)]/75">Revisá estos puntos para que la conversación con tu médico sea clara y segura.</p>
    </div>
    <div className="mt-6 grid gap-3 lg:grid-cols-2">
      <div className={itemClass}><LockKeyhole className="mt-0.5 h-5 w-5 text-[var(--primary)]" /><div><p className="font-semibold">1. Privacidad</p><p className="mt-1 text-sm text-[var(--muted)]">Buscá un lugar privado donde puedas hablar con el médico sin interrupciones.</p></div></div>
      <div className={itemClass}><Wifi className="mt-0.5 h-5 w-5 text-[var(--primary)]" /><div><p className="font-semibold">2. Conexión</p><p className="mt-1 text-sm text-[var(--muted)]">Verificá que tengas una conexión estable a Internet.</p><p className="mt-2 flex items-center gap-2 text-xs font-semibold">{stateIcon(connection)}{connectionMessage}</p></div></div>
      <div className={itemClass}><div className="flex gap-2"><Video className="mt-0.5 h-5 w-5 text-[var(--primary)]" /><Mic className="mt-0.5 h-5 w-5 text-[var(--primary)]" /></div><div className="min-w-0 flex-1"><p className="font-semibold">3. Cámara y micrófono</p><p className="mt-1 text-sm text-[var(--muted)]">Comprobá que funcionen correctamente antes de entrar.</p><div className="mt-3 overflow-hidden rounded-xl bg-black"><video ref={previewRef} muted playsInline className="aspect-video w-full object-cover" /></div><p className="mt-2 flex items-center gap-2 text-xs font-semibold">{stateIcon(mediaState)}{mediaMessage}</p><button type="button" onClick={() => void testMedia()} className="mt-3 rounded-full border border-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary)]">Probar cámara y micrófono</button></div></div>
      <div className={itemClass}><Battery className="mt-0.5 h-5 w-5 text-[var(--primary)]" /><div><p className="font-semibold">4. Batería</p><p className="mt-1 text-sm text-[var(--muted)]">Asegurate de tener batería suficiente o conectá el dispositivo al cargador.</p><p className="mt-2 text-xs font-semibold">{batteryMessage}</p></div></div>
    </div>
    <button type="button" onClick={enterRoom} disabled={connection === "error"} className="mt-6 w-full rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-50">Ingresar a la videoconsulta</button>
  </section>;
}
