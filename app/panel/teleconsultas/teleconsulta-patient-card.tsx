"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info, Video, X } from "lucide-react";

type Props = {
  turno: {
    id: string;
    paciente_id: string | null;
    nombre: string;
    email: string;
    telefono: string;
    obra_social: string | null;
    fecha_preferida: string;
    hora_preferida: string;
    duracion_minutos: number | null;
    motivo: string;
    tipo_consulta: string | null;
    meet_link: string | null;
    readyForRoom: boolean;
    roomState: "active" | "too_early" | "finished" | "unavailable" | "forbidden";
  };
};

export default function TeleconsultaPatientCard({ turno }: Props) {
  const router = useRouter();
  const [showInformation, setShowInformation] = useState(false);
  const [consultationType, setConsultationType] = useState(turno.tipo_consulta ?? "");
  const [meetLink, setMeetLink] = useState(turno.meet_link ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const isVideo = turno.tipo_consulta === "videoconsulta";
  const roomLabel = turno.roomState === "too_early" ? "Disponible 10 min antes" : turno.roomState === "finished" ? "Sesión finalizada" : "Sala no disponible";

  async function saveConfiguration() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/turnos/${turno.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "configurar_consulta", tipo_consulta: consultationType, meet_link: meetLink }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la configuración.");
      setMessage("Configuración guardada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  return <article className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">{isVideo ? "Videoconsulta confirmada" : "Configuración pendiente"}</p><h2 className="mt-1 text-lg font-semibold text-[var(--primary)]">{turno.nombre}</h2><p className="mt-1 text-sm text-[var(--muted)]">{turno.fecha_preferida} · {turno.hora_preferida} · {turno.duracion_minutos ?? 30} min</p><p className="mt-2 text-sm">Motivo: {turno.motivo}</p></div><div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => setShowInformation(true)} className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]"><Info className="h-4 w-4" />Información</button>{!isVideo ? <button type="button" onClick={() => setShowInformation(true)} className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Configurar</button> : turno.readyForRoom ? <Link href={`/panel/agenda/${turno.id}/sesion`} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"><Video className="h-4 w-4" />Abrir sala</Link> : <span className="self-center text-sm text-[var(--muted)]">{roomLabel}</span>}</div>{showInformation ? <div role="dialog" aria-modal="true" aria-labelledby={`turno-${turno.id}-title`} className="fixed inset-0 z-50 flex items-end bg-black/30 p-4 sm:items-center sm:justify-center"><section className="w-full max-w-lg rounded-lg bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(14,75,78,.25)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">Paciente confirmado</p><h2 id={`turno-${turno.id}-title`} className="mt-1 text-2xl font-semibold text-[var(--primary)]">{turno.nombre}</h2></div><button type="button" onClick={() => setShowInformation(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground)] hover:bg-[var(--accent)]/10" title="Cerrar"><X className="h-5 w-5" /><span className="sr-only">Cerrar</span></button></div><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[var(--muted)]">Fecha y hora</dt><dd className="mt-1 font-medium">{turno.fecha_preferida} · {turno.hora_preferida}</dd></div><div><dt className="text-[var(--muted)]">Email</dt><dd className="mt-1 break-all font-medium">{turno.email}</dd></div><div><dt className="text-[var(--muted)]">Teléfono</dt><dd className="mt-1 font-medium">{turno.telefono}</dd></div><div><dt className="text-[var(--muted)]">Obra social</dt><dd className="mt-1 font-medium">{turno.obra_social ?? "No informada"}</dd></div><div className="sm:col-span-2"><dt className="text-[var(--muted)]">Motivo</dt><dd className="mt-1 font-medium">{turno.motivo}</dd></div></dl><div className="mt-6 border-t border-[var(--border)] pt-5"><p className="text-sm font-semibold text-[var(--primary)]">Configuración de la consulta</p><div className="mt-3 grid gap-3"><label className="text-sm">Modalidad<select value={consultationType} onChange={(event) => setConsultationType(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"><option value="">Seleccionar</option><option value="presencial">Presencial</option><option value="videoconsulta">Videoconsulta</option></select></label>{consultationType === "videoconsulta" ? <label className="text-sm">Enlace de Meet<input type="url" value={meetLink} onChange={(event) => setMeetLink(event.target.value)} placeholder="https://meet.google.com/..." className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label> : null}<button type="button" onClick={saveConfiguration} disabled={saving || !consultationType || (consultationType === "videoconsulta" && !meetLink.trim())} className="w-fit rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Guardando..." : "Guardar configuración"}</button>{message ? <p className="text-sm text-[var(--primary)]">{message}</p> : null}</div></div>{turno.paciente_id ? <Link href={`/panel/pacientes/${turno.paciente_id}`} className="mt-6 inline-flex rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Abrir ficha clínica</Link> : <p className="mt-6 text-sm text-[var(--muted)]">El paciente aún no tiene ficha clínica vinculada.</p>}</section></div> : null}</article>;
}