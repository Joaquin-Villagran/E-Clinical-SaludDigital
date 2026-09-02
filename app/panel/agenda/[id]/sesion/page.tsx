import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import TeleconsultaSessionControls from "@/app/components/teleconsulta-session-controls";
import PatientEHRForm from "@/app/panel/pacientes/[id]/patient-ehr-form";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getAuthorizedTeleconsulta, validMeetLink } from "@/lib/teleconsulta";
import type { Database } from "@/lib/database.types";

function accessMessage(state: string, hora: string) {
  if (state === "too_early") return `El turno es a las ${hora}; todavía no está habilitado.`;
  if (state === "finished") return "Este turno ya finalizó.";
  return "Esta sesión no está disponible.";
}

// La autorización sucede antes de cargar cualquier dato clínico del paciente.
export default async function DoctorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthorizedTeleconsulta(id, "doctor");
  if (session.state === "forbidden") redirect("/panel/agenda");
  if (!session.turno || session.state !== "active") return <main className="min-h-screen bg-[var(--background)]"><SiteHeader /><p className="container mx-auto px-6 py-20 text-lg text-[var(--primary)]">{accessMessage(session.state, session.turno?.hora_preferida ?? "")}</p></main>;

  const supabase = createAdminSupabase();
  const patientResult = session.turno.paciente_id ? await supabase.from("pacientes").select("*").eq("id", session.turno.paciente_id).maybeSingle() : null;
  const patient = patientResult?.data as Database["public"]["Tables"]["pacientes"]["Row"] | null;
  const consultasResult = patient ? await supabase.from("consultas").select("*").eq("paciente_id", patient.id).order("fecha", { ascending: false }).limit(20) : { data: [] };
  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto grid gap-6 px-6 py-10 lg:grid-cols-[1.25fr_.75fr]"><div className="space-y-6"><section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Paciente</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">{patient ? `${patient.nombre} ${patient.apellido}` : session.turno.nombre}</h1><p className="mt-3 text-sm">DNI: {patient?.dni ?? "Pendiente de ficha"} · Obra social: {patient?.obra_social ?? session.turno.obra_social ?? "No informada"}</p></section>{patient ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[var(--primary)]">Nueva consulta</h2><p className="mt-1 text-sm text-[var(--muted)]">Registrá la evolución sin salir de la sesión.</p></div><Link href={`/panel/pacientes/${patient.id}`} className="rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Abrir HCE completa</Link></div><div className="mt-5"><PatientEHRForm patient={patient} antecedentes={[]} consultas={(consultasResult.data ?? []) as Database["public"]["Tables"]["consultas"]["Row"][]} diagnosticos={[]} medicaciones={[]} recetas={[]} estudios={[]} initialActiveTab="consultas" /></div></section> : <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><h2 className="text-xl font-semibold text-[var(--primary)]">Historia clínica pendiente</h2><p className="mt-2 text-sm text-[var(--muted)]">El paciente todavía no tiene ficha clínica vinculada.</p><Link href="/panel/pacientes" className="mt-4 inline-flex rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Crear historia clínica</Link></section>}</div><TeleconsultaSessionControls turnoId={id} meetLink={validMeetLink(session.turno.meet_link)} startedAt={session.turno.fecha_hora_inicio_real} finishedAt={session.turno.fecha_hora_fin_real} canManage /></section></main>;
}