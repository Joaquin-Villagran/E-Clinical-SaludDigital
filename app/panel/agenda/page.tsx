import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import PageTitle from "@/app/components/page-title";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";
import type { Database, Json } from "@/lib/database.types";
import TurnoRequestCard from "./turno-request-card";

type DoctorTurno = Omit<Database["public"]["Tables"]["turnos"]["Row"], "metadata"> & {
  metadata: Record<string, unknown> | null;
};

function parseMetadata(metadata: Json | null) {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return null;
}

function getEspecialidad(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const value = metadata["especialidad"];
  return typeof value === "string" ? value : null;
}

function getCalendarDates(start: Date, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
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

export default async function PanelAgendaPage({ searchParams }: { searchParams?: { view?: string } }) {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    redirect("/login");
  }

  const adminSupabase = createAdminSupabase();
  const supabase = adminSupabase;

  if (user.user_metadata?.role === "doctor") {
    const doctorRowResult = await supabase.from("doctors").select("id").eq("user_id", user.id).single();
    if (doctorRowResult.error && doctorRowResult.status !== 406) {
      throw new Error(doctorRowResult.error.message);
    }

    if (!doctorRowResult.data) {
      const metadata = user.user_metadata ?? {};
      const nombre =
        metadata.full_name ||
        [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") ||
        null;

      const upsertResult = await supabase.from("doctors").upsert(
        {
          user_id: user.id,
          nombre,
          profesion: metadata.profesion ?? null,
          especialidad: metadata.especialidad ?? null,
          telefono: metadata.telefono ?? null,
          documento: metadata.documento ?? null,
          sexo: metadata.sexo ?? null,
          estado_civil: metadata.estado_civil ?? null,
          obra_social: metadata.obra_social ?? null,
          metadata: metadata as Record<string, unknown> | null,
        },
        { onConflict: "user_id" }
      );

      if (upsertResult.error) {
        throw new Error(upsertResult.error.message);
      }
    }
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const weekIso = weekEnd.toISOString().slice(0, 10);
  const monthEnd = new Date(today);
  monthEnd.setDate(today.getDate() + 30);
  const monthIso = monthEnd.toISOString().slice(0, 10);

  const view = searchParams?.view ?? "week"; // 'day' | 'week' | 'month' | 'full'

  const [pendingResult, dailyResult, weeklyResult, monthlyResult, monthlyTotalResult, appointmentsResult, pendingAppointmentsResult, monthCanceledResult] = await Promise.all([
    supabase
      .from("turnos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "pendiente"),
    supabase
      .from("turnos")
      .select("id", { count: "exact", head: true })
      .eq("fecha_preferida", todayIso)
      .eq("estado", "confirmado"),
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
      .select("id", { count: "exact", head: true })
      .gte("fecha_preferida", todayIso)
      .lte("fecha_preferida", monthIso)
      .neq("estado", "cancelado"),
    supabase
      .from("turnos")
      .select("id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, estado, obra_social, metadata")
      .gte("fecha_preferida", todayIso)
      .lte("fecha_preferida", monthIso)
      .eq("estado", "confirmado")
      .order("fecha_preferida", { ascending: true })
      .limit(16),
    supabase
      .from("turnos")
      .select("id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, estado, obra_social, metadata")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("turnos")
      .select("id", { count: "exact", head: true })
      .gte("fecha_preferida", todayIso)
      .lte("fecha_preferida", monthIso)
      .eq("estado", "cancelado"),
  ]);

  if (
    pendingResult.error ||
    dailyResult.error ||
    weeklyResult.error ||
    monthlyResult.error ||
    monthlyTotalResult.error ||
    appointmentsResult.error ||
    pendingAppointmentsResult.error ||
    monthCanceledResult.error
  ) {
    throw new Error(
      pendingResult.error?.message ||
        dailyResult.error?.message ||
        weeklyResult.error?.message ||
        monthlyResult.error?.message ||
        monthlyTotalResult.error?.message ||
        appointmentsResult.error?.message ||
        pendingAppointmentsResult.error?.message ||
        monthCanceledResult.error?.message ||
        "Error cargando agenda"
    );
  }

  const pendingCount = pendingResult.count ?? 0;
  const dailyCount = dailyResult.count ?? 0;
  const weeklyCount = weeklyResult.count ?? 0;
  const monthlyCount = monthlyResult.count ?? 0;
  const confirmedMonthCount = monthlyCount;
  const monthlyTotalCount = monthlyTotalResult.count ?? 0;
  const canceledMonthCount = monthCanceledResult.count ?? 0;
  const rawAppointments = (appointmentsResult.data ?? []) as Database["public"]["Tables"]["turnos"]["Row"][];
  const rawPendingAppointments = (pendingAppointmentsResult.data ?? []) as Database["public"]["Tables"]["turnos"]["Row"][];
  const appointments = rawAppointments.map((turno) => ({
    ...turno,
    metadata: parseMetadata(turno.metadata),
  })) as DoctorTurno[];
  const pendingAppointments = rawPendingAppointments.map((turno) => ({
    ...turno,
    metadata: parseMetadata(turno.metadata),
  })) as DoctorTurno[];
  const calendarDates = getCalendarDates(today, 7);
  const appointmentsByDate = appointments.reduce<Record<string, number>>((acc, turno) => {
    const date = turno.fecha_preferida;
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});

  // Monthly calendar: build days for the full month
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(firstOfMonth);
    d.setDate(1 + i);
    return d;
  });

  const appointmentsByMonthDate = rawAppointments.reduce<Record<string, number>>((acc, turno) => {
    const date = turno.fecha_preferida;
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});

  const monthTotal = monthlyTotalCount;
  const percentConfirmed = monthTotal > 0 ? Math.round((confirmedMonthCount / monthTotal) * 100) : 0;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <PageTitle title="Agenda médica" description="Vé tu agenda diaria, semanal y mensual, + las solicitudes de turno con datos completos." />
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="/panel/estudios" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-medium hover:bg-[var(--accent)]/10">
                Subir resultados
              </a>
              <a href="/panel/pacientes" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-medium hover:bg-[var(--accent)]/10">
                Ver pacientes
              </a>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Solicitudes</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{pendingCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos pendientes por responder.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Hoy</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{dailyCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos programados para hoy.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Esta semana</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{weeklyCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos en los próximos 7 días.</p>
            </article>
            <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Próximo mes</p>
              <h2 className="mt-4 text-4xl font-semibold text-[var(--primary)]">{monthlyCount}</h2>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">Turnos en los próximos 30 días.</p>
            </article>
          </div>

          <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Calendario</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">{view === 'day' ? 'Hoy' : view === 'month' ? 'Próximo mes' : view === 'full' ? 'Calendario' : 'Próximos 7 días'}</h2>
              </div>
              <p className="text-sm text-[var(--foreground)]/75">Vé cómo se distribuyen los turnos por día.</p>
            </div>
            {view === 'full' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {monthDates.map((date) => {
                  const dateKey = date.toISOString().slice(0, 10);
                  const count = appointmentsByMonthDate[dateKey] ?? 0;
                  return (
                    <div key={dateKey} className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
                      <p className="font-semibold text-[var(--foreground)]">{formatDayLabel(date)}</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--primary)]">{count}</p>
                      <p className="text-[var(--foreground)]/75">Turnos</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                {calendarDates.map((date) => {
                  const dateKey = date.toISOString().slice(0, 10);
                  const count = appointmentsByDate[dateKey] ?? 0;
                  return (
                    <div key={dateKey} className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
                      <p className="font-semibold text-[var(--foreground)]">{formatDayLabel(date)}</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--primary)]">{count}</p>
                      <p className="text-[var(--foreground)]/75">Turnos</p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Próximos pacientes</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Próximos turnos</h2>
                </div>
                <a href="/panel/estudios" className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                  Subir resultados
                </a>
              </div>
                <div className="space-y-4">
                {appointments.length > 0 ? (
                  appointments.map((turno) => (
                    <TurnoRequestCard key={turno.id} turno={turno} />
                  ))
                ) : (
                  <p className="text-sm text-[var(--foreground)]/75">No hay turnos confirmados próximos.</p>
                )}
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Indicadores</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Resumen mensual</h2>
              </div>
              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-4">
                  <p className="text-sm text-[var(--foreground)]/75">Total turnos (30 días)</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--primary)]">{monthTotal}</p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-4">
                  <p className="text-sm text-[var(--foreground)]/75">Confirmados</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--primary)]">{confirmedMonthCount} ({percentConfirmed}%)</p>
                </div>
                <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-4">
                  <p className="text-sm text-[var(--foreground)]/75">Cancelados</p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--primary)]">{canceledMonthCount}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Solicitudes</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Pedir confirmación</h2>
              </div>

              <div className="space-y-4">
                {pendingAppointments.length > 0 ? (
                  pendingAppointments.map((turno) => <TurnoRequestCard key={turno.id} turno={turno} />)
                ) : (
                  <p className="text-sm text-[var(--foreground)]/75">No hay solicitudes de turno pendientes.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
