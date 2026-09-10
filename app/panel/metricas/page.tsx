import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import PageTitle from "@/app/components/page-title";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

type Period = "dia" | "semana" | "mes" | "anio";
function bounds(period: Period, dateValue: string) {
  const start = new Date(`${dateValue}T12:00:00`);
  const end = new Date(start);
  if (period === "semana") { start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); end.setDate(start.getDate() + 6); }
  if (period === "mes") { start.setDate(1); end.setMonth(start.getMonth() + 1, 0); }
  if (period === "anio") { start.setMonth(0, 1); end.setMonth(11, 31); }
  return { start: start.toISOString(), end: `${end.toISOString().slice(0, 10)}T23:59:59.999Z` };
}

export default async function PanelMetricasPage({ searchParams }: { searchParams: Promise<{ periodo?: string; fecha?: string }> }) {
  const user = await getServerUser();
  const role = user?.user_metadata?.role;
  if (!user || (role !== "doctor" && role !== "admin" && role !== "administrador")) redirect("/login");
  const params = await searchParams;
  const period: Period = ["dia", "semana", "mes", "anio"].includes(params.periodo ?? "") ? params.periodo as Period : "mes";
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(params.fecha ?? "") ? params.fecha! : new Date().toISOString().slice(0, 10);
  const range = bounds(period, dateValue);
  const supabase = createAdminSupabase();
  let doctorId: string | null = null;
  if (role === "doctor") {
    const doctor = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
    doctorId = doctor.data?.id ?? null;
    if (!doctorId) redirect("/panel");
  }
  let feedbackQuery = supabase.from("teleconsulta_feedback").select("calificacion, resolvio_motivo, medico_id, fecha_creacion").gte("fecha_creacion", range.start).lte("fecha_creacion", range.end);
  let interconsultaQuery = supabase.from("teleconsulta_interconsultas").select("aceptada, turno_generado, medico_origen_id, fecha").gte("fecha", range.start).lte("fecha", range.end);
  if (doctorId) { feedbackQuery = feedbackQuery.eq("medico_id", doctorId); interconsultaQuery = interconsultaQuery.eq("medico_origen_id", doctorId); }
  const [feedbackResult, interconsultaResult, teleconsultasResult] = await Promise.all([
    feedbackQuery,
    interconsultaQuery,
    doctorId ? supabase.from("turnos").select("id", { count: "exact", head: true }).eq("doctor_id", doctorId).eq("tipo_consulta", "videoconsulta").gte("fecha_preferida", range.start.slice(0, 10)).lte("fecha_preferida", range.end.slice(0, 10)) : supabase.from("turnos").select("id", { count: "exact", head: true }).eq("tipo_consulta", "videoconsulta").gte("fecha_preferida", range.start.slice(0, 10)).lte("fecha_preferida", range.end.slice(0, 10)),
  ]);
  if (feedbackResult.error || interconsultaResult.error || teleconsultasResult.error) throw new Error(feedbackResult.error?.message || interconsultaResult.error?.message || teleconsultasResult.error?.message || "No se pudieron cargar las métricas.");
  const feedback = feedbackResult.data ?? [];
  const doctorRows = role === "doctor" ? [] : ((await supabase.from("doctors").select("id, nombre, especialidad")).data ?? []);
  const referrals = interconsultaResult.data ?? [];
  const average = feedback.length ? (feedback.reduce((total, item) => total + item.calificacion, 0) / feedback.length).toFixed(1) : "0.0";
  const percentage = (value: number) => feedback.length ? `${Math.round((value / feedback.length) * 100)}%` : "0%";
  const accepted = referrals.filter((item) => item.aceptada === true).length;
  const generated = referrals.filter((item) => item.turno_generado).length;
  const cards = [["Satisfacción promedio", `${average}/3`], ["Muy buena", percentage(feedback.filter((item) => item.calificacion === 3).length)], ["Regular", percentage(feedback.filter((item) => item.calificacion === 2).length)], ["Mala", percentage(feedback.filter((item) => item.calificacion === 1).length)], ["Motivo resuelto", percentage(feedback.filter((item) => item.resolvio_motivo === "si").length)], ["Parcialmente", percentage(feedback.filter((item) => item.resolvio_motivo === "parcialmente").length)], ["No", percentage(feedback.filter((item) => item.resolvio_motivo === "no").length)], ["Interconsultas sugeridas", String(referrals.length)], ["Interconsultas aceptadas", String(accepted)], ["Turnos derivados", String(generated)], ["Videoconsultas", String(teleconsultasResult.count ?? 0)]];
  const doctorMetrics = doctorRows.map((doctor) => { const items = feedback.filter((item) => item.medico_id === doctor.id); return { ...doctor, evaluations: items.length, average: items.length ? (items.reduce((sum, item) => sum + item.calificacion, 0) / items.length).toFixed(1) : "0.0" }; });
  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-6xl px-6 py-10"><PageTitle title="CRM y analítica" description="Indicadores agregados de experiencia y gestión, separados de la historia clínica." /><form className="mt-6 flex flex-wrap gap-3"><select name="periodo" defaultValue={period} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"><option value="dia">Día</option><option value="semana">Semana</option><option value="mes">Mes</option><option value="anio">Año</option></select><input type="date" name="fecha" defaultValue={dateValue} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" /><button className="rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white">Actualizar</button></form><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <article key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-3 text-3xl font-semibold text-[var(--primary)]">{value}</p></article>)}</div>{role !== "doctor" ? <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6"><h2 className="text-xl font-semibold text-[var(--primary)]">Satisfacción por médico</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--border)] text-[var(--muted)]"><th className="px-3 py-2">Profesional</th><th className="px-3 py-2">Especialidad</th><th className="px-3 py-2">Promedio</th><th className="px-3 py-2">Evaluaciones</th></tr></thead><tbody>{doctorMetrics.map((doctor) => <tr key={doctor.id} className="border-b border-[var(--border)]"><td className="px-3 py-2 font-semibold">{doctor.nombre || "Profesional"}</td><td className="px-3 py-2">{doctor.especialidad || "No informada"}</td><td className="px-3 py-2">{doctor.average}/3</td><td className="px-3 py-2">{doctor.evaluations}</td></tr>)}</tbody></table></div></section> : null}<p className="mt-6 text-xs text-[var(--muted)]">Las métricas se calculan sobre registros de CRM del período seleccionado. No se muestra información clínica sensible.</p></section></main>;
}
