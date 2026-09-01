import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import { createServerSupabase, getServerUser } from "@/lib/supabase-server";
import type { Database } from "@/lib/database.types";
import DoctorStudyUploadForm from "./upload-form";

export default async function PanelEstudiosPage() {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    redirect("/login");
  }

  const supabase = await createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const [estudiosResult, candidateTurnosResult] = await Promise.all([
    supabase
      .from("estudios")
      .select("id, paciente_email, titulo, categoria, fecha, hora, file_url, external_url, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("turnos")
      .select("id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, estado, obra_social, metadata")
      .in("estado", ["confirmado", "finalizado"])
      .lte("fecha_preferida", today)
      .order("fecha_preferida", { ascending: true })
      .limit(8),
  ]);

  if (estudiosResult.error || candidateTurnosResult.error) {
    throw new Error(estudiosResult.error?.message || candidateTurnosResult.error?.message || "Error cargando datos de estudios");
  }

  const estudios = (estudiosResult.data ?? []) as Database["public"]["Tables"]["estudios"]["Row"][];
  const candidateTurnos = (candidateTurnosResult.data ?? []) as Database["public"]["Tables"]["turnos"]["Row"][];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Resultados médicos</p>
              <h1 className="mt-3 text-3xl font-semibold text-[var(--primary)]">Gestión de estudios</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/80">
                Subí archivos de resultados de pacientes o pegá un enlace externo. Los pacientes podrán verlos luego en su perfil.
              </p>
            </div>

            <section className="space-y-4">
              {candidateTurnos.length > 0 ? (
                <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Turnos listos</p>
                      <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Pacientes con turno finalizado o confirmado</h2>
                      <p className="mt-2 text-sm text-[var(--foreground)]/75">Seleccioná un turno para adjuntarle el resultado y marcarlo como finalizado.</p>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {candidateTurnos.map((turno) => (
                      <article key={turno.id} className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{turno.nombre}</p>
                            <h3 className="mt-2 text-lg font-semibold text-[var(--primary)]">{turno.motivo}</h3>
                            <p className="mt-2 text-sm text-[var(--foreground)]/80">{turno.email} · {turno.telefono}</p>
                          </div>
                          <div className="grid gap-2 text-sm text-[var(--foreground)]/75">
                            <span>Fecha: {turno.fecha_preferida}</span>
                            <span>Hora: {turno.hora_preferida}</span>
                            <span>Obra social: {turno.obra_social ?? "Particular / no informado"}</span>
                            <span>Estado: {turno.estado}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-8 text-sm text-[var(--foreground)]/75">
                  No hay turnos confirmados o finalizados listos para resultados.
                </div>
              )}
            </section>

            <div className="space-y-4">
              {estudios.length > 0 ? (
                estudios.map((estudio) => (
                  <article key={estudio.id} className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{estudio.categoria}</p>
                        <h2 className="mt-2 text-xl font-semibold text-[var(--primary)]">{estudio.titulo}</h2>
                        <p className="mt-2 text-sm text-[var(--foreground)]/80">Paciente: {estudio.paciente_email}</p>
                      </div>
                      <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                        {estudio.fecha} · {estudio.hora}
                      </span>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      {estudio.file_url ? (
                        <a href={estudio.file_url} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90">
                          Ver archivo
                        </a>
                      ) : null}
                      {estudio.external_url ? (
                        <a href={estudio.external_url} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--border)] bg-[var(--background)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                          Abrir enlace
                        </a>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-8 text-sm text-[var(--foreground)]/75">
                  No hay estudios cargados todavía.
                </div>
              )}
            </div>
          </div>

          <DoctorStudyUploadForm turnos={candidateTurnos as any} />
        </div>
      </section>
    </main>
  );
}
