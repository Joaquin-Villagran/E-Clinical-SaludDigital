import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import TeleconsultaSessionControls from "@/app/components/teleconsulta-session-controls";
import FichaClinicaPanel from "@/app/components/ficha-clinica-panel";
import { getAuthorizedTeleconsulta, validMeetLink } from "@/lib/teleconsulta";

function accessMessage(state: string, hora: string) {
  if (state === "too_early") return `El turno es a las ${hora}; la videollamada se habilita 10 minutos antes.`;
  if (state === "finished") return "La ventana de la videollamada ya finalizó, pero podés seguir viendo y editando la ficha.";
  return "Este turno no está configurado como videoconsulta o no está confirmado; podés revisar la ficha igualmente.";
}

// Sólo se bloquea el acceso si el turno no existe o no pertenece a este médico.
// La ficha clínica queda disponible siempre; el horario estricto sólo rige Iniciar/Finalizar sesión y Meet.
export default async function DoctorSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthorizedTeleconsulta(id, "doctor");
  if (session.state === "forbidden" || !session.turno) redirect("/panel/agenda");
  const turno = session.turno;

  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto grid gap-6 px-6 py-10 lg:grid-cols-[1.25fr_.75fr]"><div className="space-y-6">{session.state !== "active" ? <p className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-3 text-sm text-[var(--primary)]">{accessMessage(session.state, turno.hora_preferida)}</p> : null}<section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Paciente</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">{turno.nombre}</h1></div>{turno.paciente_id ? <Link href={`/panel/pacientes/${turno.paciente_id}`} className="rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Abrir HCE completa</Link> : null}</div><div className="mt-5"><FichaClinicaPanel turnoId={id} pacienteId={turno.paciente_id} prefill={{ nombreCompleto: turno.nombre, telefono: turno.telefono, email: turno.email, obraSocial: turno.obra_social }} initialActiveTab="consultas" /></div></section></div><TeleconsultaSessionControls turnoId={id} meetLink={validMeetLink(turno.meet_link)} startedAt={turno.fecha_hora_inicio_real} finishedAt={turno.fecha_hora_fin_real} canManage /></section></main>;
}