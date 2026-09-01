import Link from "next/link";
import SiteHeader from "@/app/components/site-header";
import PageTitle from "@/app/components/page-title";
import TurnoForm from "./turno-form";
import { getServerUser } from "@/lib/supabase-server";

export default async function TurnosPage() {
  const user = await getServerUser();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <PageTitle title="Solicitá tu turno" description="Si estás logueado, tus datos se completan automáticamente; solo indicá motivo, médico o especialidad y el horario." />
            <p className="max-w-2xl text-base leading-7 text-[var(--foreground)]/80">
              Si necesitás cambiar la fecha u horario más adelante, podés escribirnos desde el email de confirmación.
            </p>
            {!user ? (
              <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_18px_50px_rgba(14,75,78,0.08)]">
                <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Sesión requerida</p>
                <h2 className="mt-3 text-xl font-semibold text-[var(--primary)]">Iniciá sesión para solicitar un turno</h2>
                <p className="mt-2 text-sm text-[var(--foreground)]/75">No está permitido solicitar ni guardar un turno sin sesión activa.</p>
                <Link className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90" href="/login">
                  Ingresar
                </Link>
              </div>
            ) : null}
          </div>

          <div>{user ? <TurnoForm /> : null}</div>
        </div>
      </section>
    </main>
  );
}
