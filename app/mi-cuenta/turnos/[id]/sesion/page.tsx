import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import TeleconsultaSessionControls from "@/app/components/teleconsulta-session-controls";
import { formatElapsed } from "@/app/components/teleconsulta-session-controls";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getAuthorizedTeleconsulta, validMeetLink } from "@/lib/teleconsulta";

export default async function PatientSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthorizedTeleconsulta(id, "patient");
  if (session.state === "forbidden") redirect("/mi-cuenta");
  if (!session.turno || (session.state !== "active" && session.state !== "finished")) {
    const message = session.state === "too_early" ? `Tu turno es a las ${session.turno?.hora_preferida ?? ""}; todavía no está habilitado.` : "Este turno ya finalizó o no está disponible.";
    return <main className="min-h-screen bg-[var(--background)]"><SiteHeader /><p className="container mx-auto px-6 py-20 text-lg text-[var(--primary)]">{message}</p></main>;
  }
  const supabase = createAdminSupabase();
  const [recetasResult, estudiosResult] = session.turno.fecha_hora_fin_real && session.turno.paciente_id ? await Promise.all([supabase.from("recetas").select("id, pdf_url, fecha_emision").eq("paciente_id", session.turno.paciente_id).order("created_at", { ascending: false }).limit(5), supabase.from("estudios").select("id, titulo, archivo_url, fecha").eq("paciente_id", session.turno.paciente_id).order("created_at", { ascending: false }).limit(5)]) : [{ data: [] }, { data: [] }];
  return <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto grid gap-6 px-6 py-10 lg:grid-cols-[1fr_.8fr]"><section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Tu profesional</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">{session.doctor?.nombre ?? "Profesional asignado"}</h1><p className="mt-4 text-sm">Matrícula: {session.doctor?.documento ?? "No informada"}</p><p className="mt-1 text-sm">Especialidad: {session.doctor?.especialidad ?? "No informada"}</p>{session.turno.fecha_hora_fin_real ? <div className="mt-6 border-t border-[var(--border)] pt-5"><h2 className="font-semibold text-[var(--primary)]">Resumen de consulta</h2><p className="mt-2 text-sm">Duración: {formatElapsed(session.turno.fecha_hora_inicio_real, session.turno.fecha_hora_fin_real, 0)}</p><p className="mt-3 text-sm font-medium">Recetas: {recetasResult.data?.length ?? 0} · Estudios: {estudiosResult.data?.length ?? 0}</p></div> : null}</section><TeleconsultaSessionControls turnoId={id} meetLink={validMeetLink(session.turno.meet_link)} startedAt={session.turno.fecha_hora_inicio_real} finishedAt={session.turno.fecha_hora_fin_real} /></section></main>;
}