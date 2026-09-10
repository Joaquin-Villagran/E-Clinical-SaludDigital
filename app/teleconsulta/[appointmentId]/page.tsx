import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import FichaClinicaPanel from "@/app/components/ficha-clinica-panel";
import TeleconsultaPatientPreparation from "@/app/components/teleconsulta-patient-preparation";
import InterconsultaSuggestionForm, { type ReferralDoctor } from "@/app/components/interconsulta-suggestion-form";
import JitsiRoom from "@/components/telemedicine/JitsiRoom";
import { getAuthorizedTeleconsulta, getOrCreateVideoRoom } from "@/lib/teleconsulta";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

function backHref(role: "doctor" | "patient") {
  return role === "doctor" ? "/panel/agenda" : "/mi-cuenta";
}

export default async function TeleconsultaPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const user = await getServerUser();
  const role = user?.user_metadata?.role === "doctor" || user?.user_metadata?.role === "patient" ? user.user_metadata.role : null;
  if (!user || !role) redirect("/login");

  const access = await getAuthorizedTeleconsulta(appointmentId, role);
  if (access.state === "forbidden" || !access.turno) redirect(backHref(role));
  const turno = access.turno;
  const roomName = await getOrCreateVideoRoom(turno);
  const back = backHref(role);
  const isDoctor = role === "doctor";
  const participantName = isDoctor ? access.doctor?.nombre ?? "Profesional" : turno.nombre;
  const referralDoctorsResult = isDoctor ? await createAdminSupabase().from("doctors").select("id, nombre, especialidad, matricula, foto_url").neq("id", turno.doctor_id ?? "") : { data: [] as ReferralDoctor[] };
  const referralDoctors = (referralDoctorsResult.data ?? []) as ReferralDoctor[];
  const accessMessage = access.state === "too_early"
    ? `La sala se habilita 10 minutos antes del turno (${turno.hora_preferida}).`
    : access.state === "finished"
      ? "La ventana de la teleconsulta ya finalizó."
      : null;

  return <main className="min-h-screen bg-[var(--background)] pb-10 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Sala privada</p><h1 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Teleconsulta</h1></div><Link href={back} className="rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Volver al turno</Link></div>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><p className="text-xs text-[var(--muted)]">Paciente</p><p className="mt-1 font-semibold">{turno.nombre}</p></div><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><p className="text-xs text-[var(--muted)]">Fecha y hora</p><p className="mt-1 font-semibold">{turno.fecha_preferida} · {turno.hora_preferida}</p></div><div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4"><p className="text-xs text-[var(--muted)]">Estado de la sala</p><p className="mt-1 font-semibold">Sala habilitada</p></div></div>
    <div className="space-y-6">
      {accessMessage ? <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-5 text-sm text-[var(--primary)]"><p>{accessMessage}</p>{access.state === "finished" ? <Link href={back} className="mt-4 inline-block font-semibold underline">Regresar al turno</Link> : null}</div> : isDoctor ? <JitsiRoom appointmentId={appointmentId} roomName={roomName} displayName={participantName} email={user.email} canFinish returnHref={back} domain={process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? process.env.JITSI_DOMAIN} jwt={process.env.JITSI_JWT} /> : <TeleconsultaPatientPreparation appointmentId={appointmentId} roomName={roomName} displayName={participantName} email={user.email} returnHref={back} domain={process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? process.env.JITSI_DOMAIN} />}
      {isDoctor ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_50px_rgba(14,75,78,0.08)]"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Historia clínica</p><h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Ficha clínica completa del paciente</h2><div className="mt-5 space-y-5"><InterconsultaSuggestionForm appointmentId={appointmentId} doctors={referralDoctors} /><FichaClinicaPanel turnoId={appointmentId} pacienteId={turno.paciente_id} prefill={{ nombreCompleto: turno.nombre, telefono: turno.telefono, email: turno.email, obraSocial: turno.obra_social }} initialActiveTab="consultas" /></div></section> : null}
    </div>
  </section></main>;
}
