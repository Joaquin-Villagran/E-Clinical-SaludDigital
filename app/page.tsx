import Link from "next/link";
import SiteHeader from "@/app/components/site-header";
import PageTitle from "@/app/components/page-title";
import { ArrowRight, HeartHandshake, ShieldCheck, UserPlus } from "lucide-react";
import { getServerUser } from "@/lib/supabase-server";

export default async function HomePage() {
  const user = await getServerUser();
  const role = user?.user_metadata?.role as string | undefined;

  const isDoctor = role === "doctor";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-20">
        {isDoctor ? (
          <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <PageTitle title="Panel del profesional" description="Accedé a tu agenda, pacientes y resultados. Herramientas diseñadas para profesionales de la salud." />
              <p className="max-w-2xl text-base leading-8 text-[var(--foreground)]/80">Gestioná tus turnos, confirmaciones y resultados desde un solo lugar seguro. Integra Google Calendar y mantén tu agenda sincronizada.</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/panel" className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90">
                  Ir al panel <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/panel/agenda" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                  Ver agenda
                </Link>
              </div>
            </div>
            <div className="rounded-[3rem] border border-[var(--border)] bg-[var(--card)] p-10 shadow-[0_30px_90px_rgba(14,75,78,0.08)]">
              <div className="grid gap-6">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Herramientas</p>
                  <h2 className="text-2xl font-semibold text-[var(--primary)]">Agenda, Historia Clínica y Resultados</h2>
                </div>
                <div className="grid gap-4 rounded-[2rem] bg-[var(--background)] p-6 text-[var(--foreground)]/85">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Agenda diaria y semanal</span>
                    <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Control</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Historia clínica electrónica</span>
                    <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Estructurada</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Resultados y archivos</span>
                    <span className="rounded-full bg-[var(--foreground)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground)]">Protegido</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              <PageTitle title="Consultorio Santa María" description="Atención médica unipersonal con turnos en línea, paneles protegidos y una base sólida para seguir creciendo." />
              <p className="max-w-2xl text-base leading-8 text-[var(--foreground)]/80">Un sistema pensado para pacientes y médico. En esta fase inicial, llevamos el agendamiento digital y las solicitudes de turnos a Supabase.</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/turnos" className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90">
                  Sacar turno <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-6 py-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                  Ingresar
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_40px_rgba(14,75,78,0.08)]">
                  <div className="flex items-center gap-3 text-[var(--accent)]">
                    <HeartHandshake className="h-5 w-5" />
                    <span className="text-sm uppercase tracking-[0.3em]">Cuidado cercano</span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--foreground)]/80">Gestión de turnos sencilla y cálida para pacientes de todas las edades.</p>
                </div>
                <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_40px_rgba(14,75,78,0.08)]">
                  <div className="flex items-center gap-3 text-[var(--accent)]">
                    <ShieldCheck className="h-5 w-5" />
                    <span className="text-sm uppercase tracking-[0.3em]">Confianza</span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--foreground)]/80">Tus datos y solicitudes se guardan en una base segura preparada para crecer.</p>
                </div>
              </div>
            </div>
            <div className="rounded-[3rem] border border-[var(--border)] bg-[var(--card)] p-10 shadow-[0_30px_90px_rgba(14,75,78,0.08)]">
              <div className="grid gap-6">
                <div className="space-y-3">
                  <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Especialidad</p>
                  <h2 className="text-2xl font-semibold text-[var(--primary)]">Medicina familiar y preventiva</h2>
                </div>
                <div className="grid gap-4 rounded-[2rem] bg-[var(--background)] p-6 text-[var(--foreground)]/85">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Turnos online</span>
                    <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Fácil</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Panel médico protegido</span>
                    <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">Seguro</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Base para historia clínica electrónica</span>
                    <span className="rounded-full bg-[var(--foreground)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--foreground)]">Lista</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
