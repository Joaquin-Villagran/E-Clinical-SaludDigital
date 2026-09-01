import SiteHeader from "@/app/components/site-header";
import Link from "next/link";

import LoginForm from "./login-form";

interface LoginPageProps {
  searchParams?: Promise<{
    confirmed?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-20">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-2xl space-y-6 text-center">
            <h1 className="text-3xl font-semibold text-[var(--primary)]">Acceso</h1>
            <p className="text-sm text-[var(--foreground)]/80">Seleccioná el tipo de acceso que buscás.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/login/paciente" className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-6 text-left hover:shadow-md">
                <p className="text-xl font-semibold">Paciente</p>
                <p className="mt-2 text-sm text-[var(--foreground)]/80">Ingresá o registrate como paciente.</p>
              </Link>
              <Link href="/login/profesional" className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-6 text-left hover:shadow-md">
                <p className="text-xl font-semibold">Profesional</p>
                <p className="mt-2 text-sm text-[var(--foreground)]/80">Acceso para profesionales y administración.</p>
              </Link>
            </div>
            <p className="text-xs text-[var(--foreground)]/60">Si sos profesional y aun no tenés acceso, contactá al administrador.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
