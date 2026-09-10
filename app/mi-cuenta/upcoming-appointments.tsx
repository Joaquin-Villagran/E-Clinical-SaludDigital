"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Appointment = { value: string; fecha: string; hora: string; label: string };
type Turno = { id: string; doctorId: string; fecha_preferida: string; hora_preferida: string; estado: string; tipo_consulta: string | null; motivo: string; doctorName: string; specialty: string; modality: string };

export default function UpcomingAppointments({ turnos }: { turnos: Turno[] }) {
  const router = useRouter();
  const [items, setItems] = useState(turnos);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function openReschedule(turno: Turno) {
    setMessage("");
    setReschedulingId(turno.id);
    setSelectedAppointment("");
    const response = await fetch(`/api/disponibilidad?doctor_id=${encodeURIComponent(turno.doctorId)}`);
    if (!response.ok) {
      setAppointments([]);
      setMessage("No se pudieron cargar nuevos horarios.");
      return;
    }
    const result = await response.json();
    setAppointments(result.appointments ?? []);
  }

  async function cancel(turnoId: string) {
    if (!window.confirm("¿Querés cancelar este turno?")) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/turnos/${turnoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancelar_paciente" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cancelar el turno.");
      setItems((current) => current.filter((item) => item.id !== turnoId));
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo cancelar el turno."); }
    finally { setLoading(false); }
  }

  async function reschedule(turnoId: string) {
    const selected = appointments.find((item) => item.value === selectedAppointment);
    if (!selected) { setMessage("Seleccioná una nueva fecha y horario."); return; }
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`/api/turnos/${turnoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reprogramar_paciente", fecha_preferida: selected.fecha, hora_preferida: selected.hora }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo reprogramar el turno.");
      setItems((current) => current.map((item) => item.id === turnoId ? { ...item, fecha_preferida: result.fecha_preferida, hora_preferida: result.hora_preferida, estado: "pendiente" } : item));
      setReschedulingId(null); setSelectedAppointment(""); setMessage("Turno reprogramado. Quedó pendiente de confirmación."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo reprogramar el turno."); }
    finally { setLoading(false); }
  }

  return <div className="space-y-4">{items.length ? items.map((turno) => <article key={turno.id} className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Próximo</p><span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{turno.estado}</span></div><h3 className="text-xl font-semibold text-[var(--primary)]">{turno.fecha_preferida} · {turno.hora_preferida.slice(0, 5)} hs</h3><p className="mt-3 text-sm text-[var(--foreground)]/85">Profesional: {turno.doctorName}</p><p className="mt-1 text-sm text-[var(--foreground)]/75">Especialidad: {turno.specialty}</p><p className="mt-3 text-sm text-[var(--foreground)]/90">Motivo: {turno.motivo}</p><p className="mt-2 text-xs uppercase tracking-wider text-[var(--muted)]">{turno.modality}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => openReschedule(turno)} disabled={loading} className="rounded-full border border-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary)] disabled:opacity-60">Modificar horario</button><button type="button" onClick={() => cancel(turno.id)} disabled={loading} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Cancelar turno</button></div>{reschedulingId === turno.id ? <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"><label className="block text-sm font-semibold">Nuevo horario<select value={selectedAppointment} onChange={(event) => setSelectedAppointment(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2"><option value="">{appointments.length ? "Seleccionar fecha y horario" : "No hay horarios disponibles"}</option>{appointments.map((appointment) => <option key={appointment.value} value={appointment.value}>{appointment.label}</option>)}</select></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => reschedule(turno.id)} disabled={loading || !selectedAppointment} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{loading ? "Guardando..." : "Guardar cambio"}</button><button type="button" onClick={() => setReschedulingId(null)} className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold">Cerrar</button></div></div> : null}</article>) : <p className="text-sm text-[var(--foreground)]/75">No hay próximos turnos registrados.</p>}{message ? <p className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3 text-sm text-[var(--accent)]">{message}</p> : null}</div>;
}
