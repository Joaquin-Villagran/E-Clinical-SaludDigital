import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import PageTitle from "@/app/components/page-title";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";
import type { Database } from "@/lib/database.types";

function formatDaysRemaining(fecha: string) {
  const target = new Date(fecha);
  const now = new Date();
  const delta = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return delta;
}

function formatDateTime(fecha?: string | null, hora?: string | null) {
  if (!fecha) return "Fecha no disponible";
  try {
    const iso = hora ? `${fecha}T${hora}` : `${fecha}T00:00:00`;
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    if (hora) {
      // @ts-ignore
      opts.hour = "2-digit";
      // @ts-ignore
      opts.minute = "2-digit";
    }
    return d.toLocaleString("es-AR", opts);
  } catch (e) {
    return `${fecha} ${hora ?? ""}`;
  }
}

export default async function PanelPage() {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    redirect("/login");
  }

  // El acceso al panel ya se restringe al rol médico antes de estas consultas.
  const supabase = createAdminSupabase();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const weekIso = weekEnd.toISOString().slice(0, 10);
  const monthEnd = new Date(today);
  monthEnd.setDate(today.getDate() + 30);
  const monthIso = monthEnd.toISOString().slice(0, 10);

  const [pendingResult, upcomingWeekResult, upcomingMonthResult, todayAppointmentsResult, estudiosResult] = await Promise.all([
    supabase.from("turnos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
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
    supabase
      .from("turnos")
      .select("id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, estado")
      .eq("fecha_preferida", todayIso)
      .eq("estado", "confirmado")
      .order("hora_preferida", { ascending: true })
      .limit(10),
    supabase
      .from("estudios")
      .select("id, titulo, categoria, fecha, hora, file_url, external_url")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  if (pendingResult.error || upcomingWeekResult.error || upcomingMonthResult.error || todayAppointmentsResult.error || estudiosResult.error) {
    throw new Error(pendingResult.error?.message || upcomingWeekResult.error?.message || upcomingMonthResult.error?.message || todayAppointmentsResult.error?.message || estudiosResult.error?.message || "Error cargando datos del panel");
  }

  const pendingCount = pendingResult.count ?? 0;
  const upcomingWeekCount = upcomingWeekResult.count ?? 0;
  const upcomingMonthCount = upcomingMonthResult.count ?? 0;
  const todayAppointments = (todayAppointmentsResult.data ?? []) as Database["public"]["Tables"]["turnos"]["Row"][];
  const estudios = (estudiosResult.data ?? []) as Database["public"]["Tables"]["estudios"]["Row"][];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <PageTitle title="Panel médico" description="Controlá tu agenda, pacientes y resultados desde un solo lugar." />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Solicitudes pendientes</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{pendingCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos esperando confirmación.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Próxima semana</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{upcomingWeekCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos agendados en los próximos 7 días.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Próximo mes</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{upcomingMonthCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos agendados en los próximos 30 días.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Resultados subidos</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{estudios.length}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Últimos resultados registrados en el sistema.</p>
            </article>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Próximos pacientes</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Agenda inmediata</h2>
                </div>
                <a href="/panel/agenda" className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                  Ver agenda completa
                </a>
              </div>

              <div className="space-y-4">
                {todayAppointments.length > 0 ? (
                  todayAppointments.map((turno) => (
                    <article key={turno.id} className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--primary)]">{turno.nombre}</h3>
                          <p className="mt-2 text-sm text-[var(--foreground)]/80">{formatDateTime(turno.fecha_preferida, turno.hora_preferida)}</p>
                        </div>
                        <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                          {turno.estado}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[var(--foreground)]/85">{turno.motivo}</p>
                      <p className="mt-3 text-xs text-[var(--foreground)]/70">{turno.email} · {turno.telefono}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[var(--foreground)]/75">No hay turnos confirmados para hoy.</p>
                )}
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Resultados recientes</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Últimos estudios</h2>
              </div>

              <div className="space-y-4">
                {estudios.length > 0 ? (
                  estudios.map((estudio) => (
                    <article key={estudio.id} className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-5">
                      <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{estudio.categoria}</p>
                      <h3 className="mt-2 text-lg font-semibold text-[var(--primary)]">{estudio.titulo}</h3>
                      <p className="mt-2 text-sm text-[var(--foreground)]/80">{formatDateTime(estudio.fecha, estudio.hora)}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <a href={estudio.file_url ?? estudio.external_url ?? "#"} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--primary)]/90">
                          Ver resultado
                        </a>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-[var(--foreground)]/75">No hay resultados recientes cargados.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
