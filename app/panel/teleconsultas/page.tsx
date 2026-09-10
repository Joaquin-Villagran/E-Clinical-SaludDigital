import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import TeleconsultaPatientCard from "./teleconsulta-patient-card";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";
import { getTeleconsultaAccessState } from "@/lib/teleconsulta";

type VideoTurno = {
  id: string;
  paciente_id: string | null;
  nombre: string;
  email: string;
  telefono: string;
  obra_social: string | null;
  fecha_preferida: string;
  hora_preferida: string;
  motivo: string;
  estado: string;
  tipo_consulta: string | null;
  duracion_minutos: number | null;
  meet_link: string | null;
  fecha_hora_inicio_real: string | null;
  fecha_hora_fin_real: string | null;
};

export default async function PanelTeleconsultasPage() {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") redirect("/login");

  const supabase = createAdminSupabase();
  const doctorResult = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
  if (!doctorResult.data) redirect("/panel");

  const turnsResult = await supabase
    .from("turnos")
    .select("id, paciente_id, nombre, email, telefono, obra_social, fecha_preferida, hora_preferida, motivo, estado, tipo_consulta, duracion_minutos, meet_link, fecha_hora_inicio_real, fecha_hora_fin_real")
    .eq("doctor_id", doctorResult.data.id)
    .eq("tipo_consulta", "videoconsulta")
    .order("fecha_preferida", { ascending: true })
    .order("hora_preferida", { ascending: true })
    .limit(200);
  if (turnsResult.error) throw new Error(turnsResult.error.message);
  const turns = (turnsResult.data ?? []) as VideoTurno[];
  const finalizadas = turns.filter((turn) => ["finalizado", "cancelado", "rechazado", "no_asistio"].includes(turn.estado) || turn.fecha_hora_fin_real);
  const enProceso = turns.filter((turn) => !finalizadas.includes(turn) && (turn.estado === "en_consulta" || getTeleconsultaAccessState(turn) === "active"));
  const futuras = turns.filter((turn) => !finalizadas.includes(turn) && !enProceso.includes(turn));
  const renderSection = (title: string, sectionTurns: VideoTurno[]) => sectionTurns.length ? <section><h2 className="mb-3 text-lg font-semibold text-[var(--primary)]">{title}</h2><div className="space-y-3">{sectionTurns.map((turn) => <TeleconsultaPatientCard key={turn.id} turno={{ ...turn, readyForRoom: getTeleconsultaAccessState(turn) === "active", roomState: getTeleconsultaAccessState(turn) }} />)}</div></section> : null;

  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-5xl px-6 py-10"><div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Historial de teleconsultas</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">Tus videollamadas</h1><p className="mt-2 text-sm text-[var(--muted)]">Consultas en curso, turnos futuros y consultas finalizadas.</p></div><div className="mt-6 space-y-8">{turns.length ? <>{renderSection("En proceso", enProceso)}{renderSection("Próximas", futuras)}{renderSection("Finalizadas", finalizadas)}</> : <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">No tenés turnos de videoconsulta registrados.</p>}</div></section></main>;
}