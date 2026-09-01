import Link from "next/link";
import AuthStatus from "./auth-status";
import { HeartHandshake } from "lucide-react";
import { getServerUser } from "@/lib/supabase-server";

export default async function SiteHeader() {
  const user = await getServerUser();

  const metadata = user?.user_metadata ?? {};
  const firstNameUser = metadata.first_name ?? "";
  const lastNameUser = metadata.last_name ?? "";
  const nameFromMeta = metadata.full_name ?? [firstNameUser, lastNameUser].filter(Boolean).join(" ");
  const displayBaseName = nameFromMeta || user?.email?.split("@")[0] || "Usuario";
  let displayName = displayBaseName;
  if (user?.user_metadata?.role === "doctor") {
    const sexo = (metadata.sexo || "").toString();
    const prefix = sexo === "Femenino" ? "Dra." : "Dr.";
    displayName = `${prefix} ${displayBaseName}`;
  }

  return (
    <header className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-6 py-6">
      <Link href="/" className="flex items-center gap-3 text-xl font-semibold text-[var(--foreground)]">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] shadow-sm shadow-[var(--accent)]/10">
          <HeartHandshake className="h-5 w-5" />
        </span>
        <span>Santa María</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-3 text-sm text-[var(--foreground)]/80">
        {!user ? (
          <>
            <Link className="rounded-full bg-[var(--primary)] px-4 py-2 text-white font-semibold shadow-sm shadow-[var(--primary)]/20 transition" href="/turnos">
              Sacar turno
            </Link>
          </>
        ) : (
          <Link className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:bg-[var(--accent)]/10" href="/turnos">
            Sacar turno
          </Link>
        )}
        {user ? (
          <>
            {user.user_metadata?.role === "doctor" ? (
              <>
                <Link className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:bg-[var(--accent)]/10" href="/panel">
                  Panel médico
                </Link>
                <Link className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:bg-[var(--accent)]/10" href="/panel/agenda">
                  Agenda
                </Link>
                <Link className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:bg-[var(--accent)]/10" href="/panel/pacientes">
                  Pacientes
                </Link>
                <Link className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:bg-[var(--accent)]/10" href="/panel/estudios">
                  Resultados
                </Link>
              </>
            ) : null}
            <Link className="rounded-full border border-[var(--border)] px-4 py-2 transition hover:bg-[var(--accent)]/10" href="/mi-cuenta">
              {displayName}
            </Link>
          </>
        ) : null}
        <AuthStatus />
      </nav>
    </header>
  );
}
