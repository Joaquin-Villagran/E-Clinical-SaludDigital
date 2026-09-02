"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Video } from "lucide-react";

function formatDateTime(fecha?: string | null, hora?: string | null) {
  if (!fecha) return "Fecha no disponible";

  const dateParts = fecha.split("-").map(Number);
  const timeParts = hora?.split(":").map(Number) ?? [0, 0];
  if (dateParts.length < 3 || dateParts.some(Number.isNaN)) {
    return `${fecha} ${hora ?? ""}`;
  }

  const [year, month, day] = dateParts;
  const [hour = 0, minute = 0] = timeParts;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const weekdays = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const weekday = weekdays[date.getUTCDay()];
  const monthLabel = months[date.getUTCMonth()];
  const dayNumber = String(date.getUTCDate()).padStart(1, "0");

  if (!hora) {
    return `${weekday}, ${dayNumber} ${monthLabel}`;
  }

  const hours24 = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const isPm = hours24 >= 12;
  const hours12 = hours24 % 12 || 12;
  const ampm = isPm ? "p. m." : "a. m.";

  return `${weekday}, ${dayNumber} ${monthLabel}, ${hours12}:${minutes} ${ampm}`;
}

function getWhatsappLink(telefono: string) {
  const digits = telefono.replace(/\D+/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

type Turno = {
  id: string;
  paciente_id?: string | null;
  nombre: string;
  email: string;
  telefono: string;
  motivo: string;
  fecha_preferida: string;
  hora_preferida: string;
  estado: string;
  tipo_consulta?: string | null;
  meet_link?: string | null;
  obra_social?: string | null;
  metadata?: { especialidad?: string; [key: string]: unknown } | null;
};

type Props = {
  turno: Turno;
};

export default function TurnoRequestCard({ turno }: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(turno.estado);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(turno.fecha_preferida);
  const [newTime, setNewTime] = useState(turno.hora_preferida);
  const [consultationType, setConsultationType] = useState(turno.tipo_consulta ?? "");
  const [meetLink, setMeetLink] = useState(turno.meet_link ?? "");

  async function handleAction(action: "confirmar" | "rechazar" | "cancelar" | "en_espera" | "iniciar_consulta" | "finalizar" | "no_asistio" | "reprogramar" | "configurar_consulta") {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/turnos/${turno.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, fecha_preferida: action === "reprogramar" ? newDate : undefined, hora_preferida: action === "reprogramar" ? newTime : undefined, tipo_consulta: consultationType || undefined, meet_link: meetLink }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "No se pudo procesar la acción.");
      } else {
        const statusByAction = { confirmar: "confirmado", rechazar: "rechazado", cancelar: "cancelado", en_espera: "en_espera", iniciar_consulta: "en_consulta", finalizar: "finalizado", no_asistio: "no_asistio", reprogramar: "pendiente", configurar_consulta: "confirmado" } as const;
        setCurrentStatus(statusByAction[action]);
        setIsRescheduling(false);
        setMessage(action === "configurar_consulta" ? "Modalidad de consulta actualizada." : action === "confirmar" ? "Turno confirmado. Se enviará la confirmación cuando los servicios estén configurados." : "Estado del turno actualizado.");
        router.refresh();
      }
    } catch {
      setMessage("Ocurrió un error. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--primary)]">{turno.nombre}</h3>
          <p className="mt-1 text-sm text-[var(--foreground)]/80">{turno.email} · {turno.telefono}</p>
        </div>
        <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          {currentStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]/85">
          <p className="font-semibold text-[var(--foreground)]">Fecha y hora</p>
          <p>{formatDateTime(turno.fecha_preferida, turno.hora_preferida)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]/85">
          <p className="font-semibold text-[var(--foreground)]">Especialidad</p>
          <p>{turno.metadata?.especialidad ?? "No especificada"}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--foreground)]/85">Motivo: {turno.motivo}</p>
      <p className="mt-2 text-sm text-[var(--foreground)]/75">Obra social: {turno.obra_social ?? "Particular / no informado"}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {currentStatus === "pendiente" ? (
          <button
            type="button"
            onClick={() => handleAction("confirmar")}
            disabled={loading}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-60"
          >
            Confirmar
          </button>
        ) : null}
        {currentStatus === "pendiente" ? <button type="button" onClick={() => handleAction("rechazar")} disabled={loading} className="rounded-full border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60">Rechazar</button> : null}
        {currentStatus === "confirmado" ? <button type="button" onClick={() => handleAction("en_espera")} disabled={loading} className="rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--primary)] disabled:opacity-60">En espera</button> : null}
        {(currentStatus === "confirmado" || currentStatus === "en_espera" || currentStatus === "en_consulta") && turno.tipo_consulta === "videoconsulta" ? <Link href={`/panel/agenda/${turno.id}/sesion`} className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"><Video className="h-4 w-4" />Sala de teleconsulta</Link> : null}
        {currentStatus === "en_consulta" ? <button type="button" onClick={() => handleAction("finalizar")} disabled={loading} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Finalizar</button> : null}
        {(currentStatus === "confirmado" || currentStatus === "en_espera") ? <button type="button" onClick={() => handleAction("no_asistio")} disabled={loading} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold disabled:opacity-60">No asistió</button> : null}
        {currentStatus !== "finalizado" && currentStatus !== "cancelado" && currentStatus !== "rechazado" ? (
          <button
            type="button"
            onClick={() => setIsRescheduling((open) => !open)}
            disabled={loading}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--accent)]/10 disabled:opacity-60"
          >
            Reprogramar
          </button>
        ) : null}
        {currentStatus !== "finalizado" && currentStatus !== "cancelado" && currentStatus !== "rechazado" ? <button type="button" onClick={() => handleAction("cancelar")} disabled={loading} className="rounded-full border border-red-700 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60">Cancelar</button> : null}
        {turno.paciente_id ? <Link href={`/panel/pacientes/${turno.paciente_id}`} className="rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Ver ficha</Link> : null}
        {getWhatsappLink(turno.telefono) ? (
          <a
            href={getWhatsappLink(turno.telefono)!}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            WhatsApp
          </a>
        ) : null}
      </div>

      {currentStatus === "confirmado" ? <div className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"><label className="text-sm">Modalidad<select value={consultationType} onChange={(event) => setConsultationType(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"><option value="">Seleccionar</option><option value="presencial">Presencial</option><option value="videoconsulta">Videoconsulta</option></select></label><label className="text-sm">Enlace Meet{consultationType === "videoconsulta" ? <input type="url" required value={meetLink} onChange={(event) => setMeetLink(event.target.value)} placeholder="https://meet.google.com/..." className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /> : <input disabled value="No aplica a consulta presencial" className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--muted)]" />}</label><button type="button" onClick={() => handleAction("configurar_consulta")} disabled={loading || !consultationType || (consultationType === "videoconsulta" && !meetLink.trim())} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Guardar</button></div> : null}

      {isRescheduling ? <div className="mt-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-sm">Nueva fecha<input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Nueva hora<input type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><button type="button" onClick={() => handleAction("reprogramar")} disabled={loading || !newDate || !newTime} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Guardar</button></div> : null}

      {message ? (
        <p className="mt-4 rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}
    </article>
  );
}
