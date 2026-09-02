"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Play, Square } from "lucide-react";

type Props = {
  turnoId: string;
  meetLink: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  canManage?: boolean;
};

export function formatElapsed(startedAt: string | null, finishedAt: string | null, now: number) {
  if (!startedAt) return "00:00";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// El video abre fuera de la aplicación; este panel conserva el contexto clínico y el tiempo de la sesión.
export default function TeleconsultaSessionControls({ turnoId, meetLink, startedAt, finishedAt, canManage = false }: Props) {
  const [sessionStart, setSessionStart] = useState(startedAt);
  const [sessionEnd, setSessionEnd] = useState(finishedAt);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionStart || sessionEnd) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [sessionStart, sessionEnd]);

  async function updateSession(action: "iniciar" | "finalizar") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/turnos/${turnoId}/sesion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo actualizar la sesión.");
      setSessionStart(payload.turno.fecha_hora_inicio_real);
      setSessionEnd(payload.turno.fecha_hora_fin_real);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la sesión.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_50px_rgba(14,75,78,0.08)]">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Sesión de teleconsulta</p>
    <p className="mt-3 font-mono text-4xl font-semibold text-[var(--primary)]">{formatElapsed(sessionStart, sessionEnd, now)}</p>
    <p className="mt-1 text-sm text-[var(--muted)]">{sessionEnd ? "Sesión finalizada" : sessionStart ? "Sesión en curso" : "Esperando al profesional..."}</p>
    <div className="mt-5 flex flex-wrap gap-3">
      {meetLink ? <a href={meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4" />Abrir Google Meet</a> : <span className="text-sm text-[var(--muted)]">El enlace de Meet aún no fue configurado.</span>}
      {canManage && !sessionStart ? <button type="button" disabled={busy} onClick={() => updateSession("iniciar")} className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)] disabled:opacity-50"><Play className="h-4 w-4" />Iniciar sesión</button> : null}
      {canManage && sessionStart && !sessionEnd ? <button type="button" disabled={busy} onClick={() => updateSession("finalizar")} className="inline-flex items-center gap-2 rounded-full border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><Square className="h-4 w-4" />Finalizar sesión</button> : null}
    </div>
    {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
  </section>;
}