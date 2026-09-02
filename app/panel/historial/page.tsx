import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

type Period = "dia" | "semana" | "mes" | "anio";

function periodBounds(period: Period, selectedDate: string) {
  const base = new Date(`${selectedDate}T12:00:00`);
  const start = new Date(base);
  const end = new Date(base);
  if (period === "semana") {
    start.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    end.setDate(start.getDate() + 6);
  } else if (period === "mes") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  } else if (period === "anio") {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
  }
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function PanelHistorialPage({ searchParams }: { searchParams: Promise<{ periodo?: string; fecha?: string; q?: string; estado?: string; tipo?: string }> }) {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") redirect("/login");

  const params = await searchParams;
  const period: Period = ["dia", "semana", "mes", "anio"].includes(params.periodo ?? "") ? params.periodo as Period : "mes";
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") ? params.fecha! : new Date().toISOString().slice(0, 10);
  const { start, end } = periodBounds(period, selectedDate);
  const query = params.q?.trim().toLocaleLowerCase() ?? "";

  const supabase = createAdminSupabase();
  const doctorResult = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
  if (!doctorResult.data) redirect("/panel");

  let turnsQuery = supabase.from("turnos").select("id, paciente_id, consulta_id, nombre, motivo, fecha_preferida, hora_preferida, estado, tipo_consulta").eq("doctor_id", doctorResult.data.id).gte("fecha_preferida", start).lte("fecha_preferida", end).in("estado", ["finalizado", "no_asistio"]);
  if (params.estado === "finalizado" || params.estado === "no_asistio") turnsQuery = turnsQuery.eq("estado", params.estado);
  if (params.tipo) turnsQuery = turnsQuery.eq("tipo_consulta", params.tipo);
  const turnsResult = await turnsQuery.order("fecha_preferida", { ascending: false }).order("hora_preferida", { ascending: false }).limit(250);
  if (turnsResult.error) throw new Error(turnsResult.error.message);
  const turns = turnsResult.data ?? [];

  const patientIds = turns.flatMap((turn) => turn.paciente_id ? [turn.paciente_id] : []);
  const patientsResult = patientIds.length ? await supabase.from("pacientes").select("id, dni, nombre, apellido").in("id", patientIds) : { data: [], error: null };
  if (patientsResult.error) throw new Error(patientsResult.error.message);
  const patients = new Map((patientsResult.data ?? []).map((patient) => [patient.id, patient]));
  const visibleTurns = turns.filter((turn) => {
    if (!query) return true;
    const patient = turn.paciente_id ? patients.get(turn.paciente_id) : null;
    return [turn.nombre, turn.motivo, patient?.dni, patient?.nombre, patient?.apellido].filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
  });

  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-6xl px-6 py-10"><div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Pacientes atendidos</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">Historial de atenciones</h1><p className="mt-2 text-sm text-[var(--muted)]">Consultá las atenciones finalizadas y ausencias de tu agenda.</p><form className="mt-6 grid gap-3 md:grid-cols-[auto_auto_1fr_auto_auto]"><select name="periodo" defaultValue={period} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"><option value="dia">Día</option><option value="semana">Semana</option><option value="mes">Mes</option><option value="anio">Año</option></select><input type="date" name="fecha" defaultValue={selectedDate} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" /><input name="q" defaultValue={params.q} placeholder="Paciente, DNI o motivo" className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" /><select name="estado" defaultValue={params.estado ?? ""} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"><option value="">Todas las atenciones</option><option value="finalizado">Finalizadas</option><option value="no_asistio">No asistió</option></select><select name="tipo" defaultValue={params.tipo ?? ""} className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"><option value="">Todos los tipos</option><option value="videoconsulta">Videoconsulta</option><option value="presencial">Presencial</option></select><button className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white md:col-start-5">Filtrar</button></form></div><div className="mt-6 space-y-3">{visibleTurns.length ? visibleTurns.map((turn) => { const patient = turn.paciente_id ? patients.get(turn.paciente_id) : null; return <article key={turn.id} className="grid gap-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">{turn.estado.replace("_", " ")} · {turn.tipo_consulta ?? "Tipo no informado"}</p><h2 className="mt-1 text-lg font-semibold text-[var(--primary)]">{patient ? `${patient.nombre} ${patient.apellido}` : turn.nombre}</h2><p className="mt-1 text-sm text-[var(--muted)]">DNI: {patient?.dni ?? "No informado"} · {turn.fecha_preferida} {turn.hora_preferida}</p><p className="mt-2 text-sm">Motivo: {turn.motivo}</p></div>{turn.paciente_id ? <Link href={`/panel/pacientes/${turn.paciente_id}`} className="inline-flex justify-center rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Abrir ficha</Link> : null}</article>; }) : <p className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-sm text-[var(--muted)]">No hay atenciones para los filtros elegidos.</p>}</div></section></main>;
}