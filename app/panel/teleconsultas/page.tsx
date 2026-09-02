import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import TeleconsultaPatientCard from "./teleconsulta-patient-card";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";
import { getTeleconsultaAccessState, validMeetLink } from "@/lib/teleconsulta";

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
    .eq("estado", "confirmado")
    .order("fecha_preferida", { ascending: true })
    .order("hora_preferida", { ascending: true })
    .limit(100);
  if (turnsResult.error) throw new Error(turnsResult.error.message);
  const turns = (turnsResult.data ?? []) as VideoTurno[];

  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-5xl px-6 py-10"><div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Agenda remota</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">Sala de teleconsulta</h1><p className="mt-2 text-sm text-[var(--muted)]">Tus turnos confirmados: configurá la modalidad antes de abrir una sala.</p></div><div className="mt-6 space-y-3">{turns.length ? turns.map((turn) => <TeleconsultaPatientCard key={turn.id} turno={{ ...turn, readyForRoom: validMeetLink(turn.meet_link) !== null && getTeleconsultaAccessState(turn) === "active", roomState: getTeleconsultaAccessState(turn) }} />) : <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">No tenés turnos confirmados asignados. Confirmá o configurá el turno desde Agenda para vincularlo a tu cuenta profesional.</p>}</div></section></main>;
}