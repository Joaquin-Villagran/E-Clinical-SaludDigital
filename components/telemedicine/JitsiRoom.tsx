"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

type JitsiApi = {
  dispose: () => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  getNumberOfParticipants?: () => number;
  addEventListener: (event: string, handler: (...args: unknown[]) => void) => void;
};

type JitsiConstructor = new (domain: string, options: Record<string, unknown>) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiConstructor;
  }
}

type Props = {
  roomName: string;
  displayName: string;
  email?: string | null;
  onJoined?: () => void;
  onLeft?: () => void;
  onError?: (message: string) => void;
  appointmentId: string;
  canFinish?: boolean;
  returnHref: string;
  domain?: string;
  jwt?: string;
};

const scriptId = "jitsi-external-api";

function loadJitsiScript() {
  return new Promise<JitsiConstructor>((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve(window.JitsiMeetExternalAPI);
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener("load", () => window.JitsiMeetExternalAPI ? resolve(window.JitsiMeetExternalAPI) : reject(new Error("Jitsi no está disponible.")));
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Jitsi.")));
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => window.JitsiMeetExternalAPI ? resolve(window.JitsiMeetExternalAPI) : reject(new Error("Jitsi no está disponible."));
    script.onerror = () => reject(new Error("No se pudo cargar Jitsi."));
    document.head.appendChild(script);
  });
}

export default function JitsiRoom({ roomName, displayName, email, onJoined, onLeft, onError, appointmentId, canFinish = false, returnHref, domain = "meet.jit.si", jwt }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [status, setStatus] = useState("Conectando con la sala...");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [invitationCopied, setInvitationCopied] = useState(false);

  const redirectAfterClose = canFinish ? returnHref : `/teleconsulta/${appointmentId}/cierre`;

  function closeForPatient(reason = "La consulta fue finalizada por el profesional") {
    setStatus(reason);
    apiRef.current?.executeCommand("hangup");
    apiRef.current?.dispose();
    apiRef.current = null;
    router.push(redirectAfterClose);
  }

  useEffect(() => {
    let disposed = false;
    let api: JitsiApi | null = null;

    async function initialize() {
      try {
        const JitsiMeetExternalAPI = await loadJitsiScript();
        if (disposed || !containerRef.current) return;
        api = new JitsiMeetExternalAPI(domain, {
          roomName,
          lang: "es",
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName, email: email ?? undefined },
          ...(jwt ? { jwt } : {}),
          configOverwrite: {
            prejoinConfig: { enabled: false },
            enableWelcomePage: false,
            requireDisplayName: false,
            disableAP: true,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: ["microphone", "camera", "chat", "hangup", "fullscreen"],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            MOBILE_APP_PROMO: false,
            HIDE_DEEP_LINKING_LOGO: true,
          },
        });
        apiRef.current = api;
        api.addEventListener("videoConferenceJoined", () => {
          setStatus("Esperando al otro participante");
          void fetch(`/api/teleconsulta/${appointmentId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join" }) });
          if (canFinish) void fetch(`/api/teleconsulta/${appointmentId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
          onJoined?.();
        });
        api.addEventListener("participantJoined", () => setStatus("Otro participante conectado"));
        api.addEventListener("participantLeft", () => {
          const activeParticipants = api?.getNumberOfParticipants?.() ?? 0;
          if (!canFinish && activeParticipants <= 1) {
            closeForPatient();
          } else {
            setStatus("Esperando al otro participante");
          }
        });
        api.addEventListener("conferenceJoined", () => {
          setStatus((api?.getNumberOfParticipants?.() ?? 1) > 1 ? "Otro participante conectado" : "Esperando al otro participante");
        });
        api.addEventListener("readyToClose", () => {
          setStatus("Has salido de la teleconsulta");
          void fetch(`/api/teleconsulta/${appointmentId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "leave" }) });
          onLeft?.();
          router.push(redirectAfterClose);
        });
        api.addEventListener("connectionFailed", () => { setStatus("Error de conexión"); onError?.("No se pudo conectar con la sala de teleconsulta."); });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo cargar la videollamada.";
        setStatus("Error de conexión");
        onError?.(message);
      }
    }

    initialize();
    return () => {
      disposed = true;
      api?.dispose();
      apiRef.current = null;
    };
  }, [appointmentId, canFinish, displayName, domain, email, jwt, onError, onJoined, onLeft, returnHref, roomName, router]);

  useEffect(() => {
    if (canFinish) return;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/teleconsulta/${appointmentId}`, { cache: "no-store" });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          if (payload?.state === "finished" || response.status === 409) {
            closeForPatient();
          }
          return;
        }
        const payload = await response.json().catch(() => null);
        if (payload?.state === "finished") {
          closeForPatient();
        }
      } catch {
        // La videollamada continúa si una comprobación puntual no responde.
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [appointmentId, canFinish, redirectAfterClose, router]);

  function toggleAudio() {
    apiRef.current?.executeCommand("toggleAudio");
    setMuted((value) => !value);
  }

  function toggleVideo() {
    apiRef.current?.executeCommand("toggleVideo");
    setCameraOff((value) => !value);
  }

  async function copyInvitation() {
    const invitationUrl = `${window.location.origin}/teleconsulta/${appointmentId}`;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setInvitationCopied(true);
      window.setTimeout(() => setInvitationCopied(false), 2500);
    } catch {
      onError?.("No se pudo copiar la invitación. Podés copiar la URL de la barra del navegador.");
    }
  }

  async function finishConsultation() {
    if (!window.confirm("¿Desea finalizar la teleconsulta?")) return;
    const response = await fetch(`/api/teleconsulta/${appointmentId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finish" }) });
    if (!response.ok) {
      onError?.("No se pudo finalizar la teleconsulta.");
      return;
    }
    apiRef.current?.executeCommand("hangup");
    router.push(returnHref);
  }

  return <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[#0E4B4E] shadow-[0_20px_60px_rgba(14,75,78,0.2)]">
    <div className="flex items-center justify-between px-4 py-3 text-white"><p className="text-sm font-semibold">Videollamada</p><p className="text-xs text-white/75">{status}</p></div>
    <div ref={containerRef} className="h-[min(70vh,42rem)] min-h-[28rem] bg-black" />
    <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-4">
      <button type="button" onClick={toggleAudio} title={muted ? "Activar micrófono" : "Silenciar micrófono"} className="rounded-full bg-white/15 p-3 text-white hover:bg-white/25">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
      <button type="button" onClick={toggleVideo} title={cameraOff ? "Activar cámara" : "Desactivar cámara"} className="rounded-full bg-white/15 p-3 text-white hover:bg-white/25">{cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}</button>
      {canFinish ? <button type="button" onClick={copyInvitation} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/25">{invitationCopied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}{invitationCopied ? "Invitación copiada" : "Copiar invitación privada"}</button> : null}
      {canFinish ? <button type="button" onClick={finishConsultation} title="Finalizar teleconsulta" className="rounded-full bg-red-600 p-3 text-white hover:bg-red-700"><PhoneOff className="h-5 w-5" /></button> : <button type="button" onClick={() => apiRef.current?.executeCommand("hangup")} title="Salir de la videollamada" className="rounded-full bg-red-600 p-3 text-white hover:bg-red-700"><PhoneOff className="h-5 w-5" /></button>}
    </div>
  </section>;
}
