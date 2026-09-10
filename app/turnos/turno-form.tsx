"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Mail, MessageSquare, Phone, RefreshCw, User } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";
type Doctor = { id: string; nombre: string | null; especialidad: string | null; profesion: string | null };
type Appointment = { value: string; fecha: string; hora: string; label: string };
type CreatedTurno = { id: string; fecha_preferida: string; hora_preferida: string; estado: string; tipo_consulta: string; obra_social: string | null; motivo: string; metadata: { especialidad?: string; modalidad_solicitada?: string }; doctor: { nombre: string | null; especialidad: string | null } | null };
type Patient = { id?: string; nombre: string; apellido: string; dni: string; fecha_nacimiento: string | null; sexo: string | null; direccion: string | null; telefono: string | null; email: string | null; obra_social: string | null; numero_afiliado: string | null };

const emptyPatient: Patient = { nombre: "", apellido: "", dni: "", fecha_nacimiento: null, sexo: null, direccion: null, telefono: null, email: null, obra_social: null, numero_afiliado: null };
const fieldClass = "w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80";

export default function TurnoForm() {
  const searchParams = useSearchParams();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patient, setPatient] = useState<Patient>(emptyPatient);
  const [specialty, setSpecialty] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [appointment, setAppointment] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultationType, setConsultationType] = useState("videoconsulta");
  const [comment, setComment] = useState("");
  const [editPatient, setEditPatient] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [createdTurno, setCreatedTurno] = useState<CreatedTurno | null>(null);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const specialties = useMemo(() => Array.from(new Set(doctors.map((doctor) => doctor.especialidad).filter(Boolean))) as string[], [doctors]);
  const filteredDoctors = doctors.filter((doctor) => doctor.especialidad === specialty);

  useEffect(() => {
    fetch("/api/turnos").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cargar la agenda.");
      setDoctors(result.doctors ?? []);
      setPatient(result.paciente ?? emptyPatient);
      setStatus("idle");
    }).catch((error) => { setStatus("error"); setMessage(error instanceof Error ? error.message : "No se pudo cargar la agenda."); });
  }, []);

  useEffect(() => { setDoctorId(""); setAppointment(""); setAppointments([]); }, [specialty]);

  async function loadAppointments(resetSelection = true, showLoading = true) {
    if (!doctorId) { setAppointments([]); return; }
    if (showLoading) setLoadingAppointments(true);
    if (resetSelection) setAppointment("");
    try {
      const response = await fetch(`/api/disponibilidad?doctor_id=${encodeURIComponent(doctorId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo consultar la disponibilidad.");
      setAppointments(result.appointments);
    } catch (error) {
      setAppointments([]);
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los horarios.");
    } finally { if (showLoading) setLoadingAppointments(false); }
  }

  useEffect(() => {
    void loadAppointments();
    const refresh = () => void loadAppointments(false);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [doctorId]);

  function updatePatient(field: keyof Patient, value: string) { setPatient((current) => ({ ...current, [field]: value })); }

  async function savePatient() {
    const response = await fetch("/api/pacientes/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patient) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudieron guardar tus datos.");
    setPatient(result.paciente); setEditPatient(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("loading"); setMessage("");
    try {
      if (editPatient) await savePatient();
      const selectedAppointment = appointments.find((item) => item.value === appointment);
      if (!doctorId || !selectedAppointment || !comment.trim()) throw new Error("Seleccioná un médico, un turno disponible y escribí un comentario.");
      const response = await fetch("/api/turnos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doctor_id: doctorId, especialidad: specialty, fecha_preferida: selectedAppointment.fecha, hora_preferida: selectedAppointment.hora, motivo: comment.trim(), obra_social: patient.obra_social, tipo_consulta: consultationType, es_particular: !patient.obra_social, interconsulta_id: searchParams.get("interconsulta_id") || undefined }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo solicitar el turno.");
      setStatus("success"); setMessage("Solicitud enviada. El profesional revisará tu turno."); setCreatedTurno(result.turno as CreatedTurno); setAppointment(""); setAppointments((current) => current.filter((item) => item.value !== appointment)); setComment("");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "No se pudo solicitar el turno."); }
  }

  if (createdTurno) return (
    <section className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Solicitud guardada</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Resumen de tu turno</h2>
        <p className="mt-2 text-sm text-[var(--foreground)]/75">Tu solicitud quedó registrada en tu historial.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-[var(--background)] p-4"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Profesional</p><p className="mt-1 font-semibold">{createdTurno.doctor?.nombre ?? "Profesional"}</p><p className="text-sm">{createdTurno.doctor?.especialidad ?? createdTurno.metadata?.especialidad ?? "Especialidad no informada"}</p></div>
        <div className="rounded-2xl bg-[var(--background)] p-4"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Fecha y horario</p><p className="mt-1 font-semibold">{createdTurno.fecha_preferida} · {createdTurno.hora_preferida.slice(0, 5)} hs</p></div>
        <div className="rounded-2xl bg-[var(--background)] p-4"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Modalidad</p><p className="mt-1 font-semibold">{createdTurno.tipo_consulta === "presencial" ? "Consulta presencial" : "Videoconsulta"}</p></div>
        <div className="rounded-2xl bg-[var(--background)] p-4"><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Estado</p><p className="mt-1 font-semibold capitalize">{createdTurno.estado}</p></div>
      </div>
      <div className="rounded-2xl border border-[var(--border)] p-4 text-sm"><p><strong>Obra social:</strong> {createdTurno.obra_social || "Particular"}</p><p className="mt-2"><strong>Motivo:</strong> {createdTurno.motivo}</p></div>
      <div className="flex flex-wrap gap-3"><a href="/mi-cuenta#historial-turnos" className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white">Ver historial de turnos</a><button type="button" onClick={() => { setCreatedTurno(null); setStatus("idle"); }} className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold">Solicitar otro turno</button></div>
    </section>
  );

  return <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Antes de reservar</p><h2 className="mt-1 text-xl font-semibold text-[var(--primary)]">Confirmá tus datos</h2></div><button type="button" onClick={() => setEditPatient((value) => !value)} className="rounded-full border border-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary)]">{editPatient ? "Cerrar edición" : "Modificar datos"}</button></div>
      {editPatient ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm">Nombre<input required value={patient.nombre} onChange={(event) => updatePatient("nombre", event.target.value)} className={fieldClass} /></label><label className="text-sm">Apellido<input required value={patient.apellido} onChange={(event) => updatePatient("apellido", event.target.value)} className={fieldClass} /></label><label className="text-sm">DNI<input required value={patient.dni} onChange={(event) => updatePatient("dni", event.target.value)} className={fieldClass} /></label><label className="text-sm"><span className="flex items-center gap-2"><Phone className="h-4 w-4" />Teléfono</span><input required value={patient.telefono ?? ""} onChange={(event) => updatePatient("telefono", event.target.value)} className={fieldClass} /></label><label className="text-sm sm:col-span-2">Obra social / prepaga<input value={patient.obra_social ?? ""} onChange={(event) => updatePatient("obra_social", event.target.value)} className={fieldClass} /></label><label className="text-sm sm:col-span-2">Número de afiliado<input value={patient.numero_afiliado ?? ""} onChange={(event) => updatePatient("numero_afiliado", event.target.value)} className={fieldClass} /></label></div> : <div className="mt-4 grid gap-2 text-sm text-[var(--foreground)]/80 sm:grid-cols-2"><p><User className="mr-2 inline h-4 w-4" />{patient.nombre || "Sin nombre"} {patient.apellido}</p><p><Mail className="mr-2 inline h-4 w-4" />{patient.email || "Sin email"}</p><p><Phone className="mr-2 inline h-4 w-4" />{patient.telefono || "Sin teléfono"}</p><p>Obra social: <strong>{patient.obra_social || "Particular"}</strong></p></div>}
    </section>
    <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm"><span>Especialidad</span><select required value={specialty} onChange={(event) => { setSpecialty(event.target.value); setMessage(""); }} className={fieldClass}><option value="">Seleccionar especialidad</option>{specialties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="space-y-2 text-sm"><span>Especialista</span><select required value={doctorId} onChange={(event) => { setDoctorId(event.target.value); setMessage(""); }} disabled={!specialty} className={fieldClass}><option value="">Seleccionar médico</option>{filteredDoctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.nombre || "Profesional"}</option>)}</select></label><label className="space-y-2 text-sm sm:col-span-2"><span className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />Fecha y horario disponible {appointments.length ? <small className="font-normal text-[var(--muted)]">({appointments.length} disponibles)</small> : null}</span><button type="button" onClick={() => void loadAppointments()} disabled={!doctorId || loadingAppointments} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)] disabled:opacity-50" title="Actualizar horarios"><RefreshCw className={`h-3.5 w-3.5 ${loadingAppointments ? "animate-spin" : ""}`} />Actualizar</button></span><select required value={appointment} onFocus={() => void loadAppointments(false, false)} onChange={(event) => setAppointment(event.target.value)} disabled={!doctorId || loadingAppointments || appointments.length === 0} className={fieldClass}><option value="">{loadingAppointments ? "Cargando horarios..." : appointments.length ? "Seleccionar fecha y horario" : "El médico aún no publicó horarios"}</option>{appointments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{doctorId && !loadingAppointments && appointments.length === 0 && !message ? <p className="mt-1 text-xs text-[var(--muted)]">Este profesional no tiene fechas futuras publicadas. Probá actualizar.</p> : null}</label></div>
    <fieldset><legend className="mb-3 text-sm font-semibold text-[var(--foreground)]">Modalidad de atención</legend><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-2xl border p-4 text-sm ${consultationType === "videoconsulta" ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]"}`}><input type="radio" name="tipo_consulta" value="videoconsulta" checked={consultationType === "videoconsulta"} onChange={(event) => setConsultationType(event.target.value)} className="mr-2" />Videoconsulta</label><label className={`cursor-pointer rounded-2xl border p-4 text-sm ${consultationType === "presencial" ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)]"}`}><input type="radio" name="tipo_consulta" value="presencial" checked={consultationType === "presencial"} onChange={(event) => setConsultationType(event.target.value)} className="mr-2" />Consulta presencial</label></div></fieldset>
    <label className="space-y-2 text-sm"><span className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Comentario o motivo de la consulta</span><textarea required rows={4} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Contale al profesional qué necesitás" className={fieldClass} /></label>
    {message ? <div className={`rounded-2xl border px-4 py-3 text-sm ${status === "success" ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"}`}>{message}</div> : null}
    <button disabled={status === "loading" || !doctors.length} type="submit" className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-60">{status === "loading" ? "Enviando..." : "Solicitar turno"}</button>
  </form>;
}
