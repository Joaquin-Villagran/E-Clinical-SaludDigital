import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import { createServerSupabase, getServerUser } from "@/lib/supabase-server";

export default async function PanelEstadisticasPage() {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    redirect("/login");
  }

  const supabase = await createServerSupabase();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const weekIso = weekEnd.toISOString().slice(0, 10);
  const monthEnd = new Date(today);
  monthEnd.setDate(today.getDate() + 30);
  const monthIso = monthEnd.toISOString().slice(0, 10);

  const [pendingTurnos, todayConfirmedTurnos, weekConfirmedTurnos, monthConfirmedTurnos, estudios, pacientes] = await Promise.all([
    supabase.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase
      .from("turnos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "confirmado")
      .eq("fecha_preferida", todayIso),
    supabase
      .from("turnos")
      .select("id", { count: "exact", head: true })
      .gte("fecha_preferida", todayIso)
      .lte("fecha_preferida", weekIso)
      .eq("estado", "confirmado"),
    supabase
      .from("turnos")
      .select("id", { count: "exact", head: true })
      .gte("fecha_preferida", todayIso)
      .lte("fecha_preferida", monthIso)
      .eq("estado", "confirmado"),
    supabase.from("estudios").select("id", { count: "exact", head: true }),
    supabase.from("pacientes").select("id", { count: "exact", head: true }),
  ]);

  if (pendingTurnos.error || todayConfirmedTurnos.error || weekConfirmedTurnos.error || monthConfirmedTurnos.error || estudios.error || pacientes.error) {
    throw new Error(
      pendingTurnos.error?.message ||
      todayConfirmedTurnos.error?.message ||
      weekConfirmedTurnos.error?.message ||
      monthConfirmedTurnos.error?.message ||
      estudios.error?.message ||
      pacientes.error?.message ||
      "Error cargando estadísticas"
    );
  }

  const pendingCount = pendingTurnos.count ?? 0;
  const todayConfirmedCount = todayConfirmedTurnos.count ?? 0;
  const weekConfirmedCount = weekConfirmedTurnos.count ?? 0;
  const monthConfirmedCount = monthConfirmedTurnos.count ?? 0;
  const estudiosCount = estudios.count ?? 0;
  const pacientesCount = pacientes.count ?? 0;

  return (
    <main className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)] sm:p-8">
            <h1 className="text-3xl font-semibold text-[var(--primary)]">Estadísticas</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/80 sm:text-base">
              En esta página podés monitorear el estado de turnos, resultados cargados y pacientes registrados.
            </p>
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Turnos pendientes</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{pendingCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Solicitudes que requieren revisión.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Turnos confirmados hoy</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{todayConfirmedCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Consultas confirmadas para hoy.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Resultados</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{estudiosCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Estudios subidos al sistema.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Pacientes</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{pacientesCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Registros de pacientes en la base.</p>
            </article>
          </div>

          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <h2 className="text-lg font-semibold text-[var(--primary)]">Rendimiento</h2>
              <p className="mt-3 text-sm text-[var(--foreground)]/75 sm:text-base">Mantente al tanto del volumen de consultas y resultados. Estas métricas se actualizan automáticamente con los datos de tu práctica.</p>
            </section>
            <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <h2 className="text-lg font-semibold text-[var(--primary)]">Próximo paso</h2>
              <p className="mt-3 text-sm text-[var(--foreground)]/75 sm:text-base">Usá la agenda para ver tus turnos diarios y mes a mes, y cargá resultados clínicos en la sección de estudios.</p>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
