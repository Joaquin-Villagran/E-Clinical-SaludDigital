import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import { createServerSupabase, getServerUser } from "@/lib/supabase-server";
import type { Database } from "@/lib/database.types";
import ProfileForm from "./profile-form";

const quickActions = [
  { label: "Nuevo turno", href: "/turnos" },
  { label: "Mis turnos", href: "#mis-turnos" },
  { label: "Mi perfil", href: "#mi-perfil" },
  { label: "Mis estudios", href: "#mis-estudios" },
];

function formatDaysRemaining(fecha: string) {
  const target = new Date(fecha);
  const now = new Date();
  const delta = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return delta;
}

export default async function MiCuentaPage() {
  const user = await getServerUser();
  if (!user || !user.email) {
    redirect("/login");
  }

  // El médico trabaja desde el panel: esta vista contiene acciones exclusivas de pacientes.
  if (user.user_metadata?.role === "doctor") {
    redirect("/panel");
  }

  const supabase = await createServerSupabase();
  const turnosResult = await supabase
    .from("turnos")
    .select("id, motivo, fecha_preferida, hora_preferida")
    .match({ email: user.email, estado: "pendiente" })
    .order("fecha_preferida", { ascending: true })
    .limit(4);

  const estudiosResult = await supabase
    .from("estudios")
    .select("id, titulo, categoria, fecha, hora, file_url, external_url")
    .match({ paciente_email: user.email })
    .order("fecha", { ascending: false })
    .limit(4);

  const turnos = (turnosResult.data ?? []) as Database["public"]["Tables"]["turnos"]["Row"][];
  const estudios = (estudiosResult.data ?? []) as Database["public"]["Tables"]["estudios"]["Row"][];
  const fullName =
    user.user_metadata?.full_name ||
    [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ");

  const profileName = fullName || "Paciente";
  const profileDescription = "Este es tu espacio personal para ver tus próximos turnos, tus estudios recientes y tus datos personales.";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="grid gap-10">
          <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Bienvenido:</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--primary)]">{profileName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground)]/80">
              {profileDescription}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6 text-center text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5"
              >
                {action.label}
              </a>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <section id="mis-turnos" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Mis próximos turnos</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Turnos próximos</h2>
                  </div>
                  <a href="/turnos" className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--primary)]/90">
                    Solicitar nuevo
                  </a>
                </div>

                <div className="space-y-4">
                  {turnos && turnos.length > 0 ? (
                    turnos.map((turno) => {
                      const dias = formatDaysRemaining(turno.fecha_preferida);
                      return (
                        <article
                          key={turno.id}
                          className={`rounded-[2rem] border p-5 ${dias <= 3 ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] bg-[var(--background)]"}`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">{dias <= 3 ? "Urgente" : "Próximo"}</p>
                            <span className="text-sm text-[var(--foreground)]/75">{dias} días</span>
                          </div>
                          <h3 className="text-xl font-semibold text-[var(--primary)]">{turno.fecha_preferida} · {turno.hora_preferida}</h3>
                          <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/85">Profesional: Dra. Santa María</p>
                          <p className="mt-3 text-sm text-[var(--foreground)]/90">Motivo: {turno.motivo}</p>
                        </article>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[var(--foreground)]/75">No hay próximos turnos registrados.</p>
                  )}
                </div>
              </section>

              <section id="mis-estudios" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Mis últimos estudios</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Resultados recientes</h2>
                  </div>
                  <a href="#mis-estudios" className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                    Ver todos
                  </a>
                </div>

                <div className="space-y-4">
                  {estudios && estudios.length > 0 ? (
                    estudios.map((estudio) => (
                      <article key={estudio.id} className="grid gap-4 rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{estudio.categoria}</p>
                          <h3 className="mt-2 text-xl font-semibold text-[var(--primary)]">{estudio.titulo}</h3>
                          <p className="mt-3 text-sm text-[var(--foreground)]/80">{estudio.fecha} · {estudio.hora}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <a
                            href={estudio.file_url ?? estudio.external_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90"
                          >
                            Descargar
                          </a>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6 text-sm text-[var(--foreground)]/75">
                      No hay estudios registrados todavía.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section id="mi-perfil" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Mi perfil</p>
               
                <div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--primary)]">Tus datos personales</h3>
                  <p className="mt-2 text-sm text-[var(--foreground)]/80">Desde aquí podés actualizar tu nombre, teléfono, documento y otros datos.</p>
                  <div className="mt-4">
                    <ProfileForm />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
