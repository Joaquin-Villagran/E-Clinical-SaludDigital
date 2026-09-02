"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, ClipboardList, Home, LogOut, MoreHorizontal, Stethoscope, Users, Video } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

const primaryItems = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/panel/pacientes", label: "Pacientes", icon: Users },
  { href: "/panel/teleconsultas", label: "Teleconsultas", icon: Video },
];

function isCurrent(pathname: string, href: string) {
  return href === "/panel" ? pathname === href : pathname.startsWith(href);
}

// Reúne la navegación de uso diario y mantiene las opciones ocasionales fuera del flujo principal.
export default function DoctorNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const moreIsCurrent = pathname.startsWith("/panel/estadisticas") || pathname.startsWith("/panel/historial") || pathname.startsWith("/panel/mi-perfil");

  return <>
    <nav aria-label="Navegación del panel médico" className="hidden items-center gap-1 md:flex">
      {primaryItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${isCurrent(pathname, href) ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/80 hover:bg-[var(--accent)]/10"}`}><Icon className="h-4 w-4" />{label}</Link>)}
      <div className="relative">
        <button type="button" aria-expanded={isMoreOpen} aria-haspopup="menu" onClick={() => setIsMoreOpen((open) => !open)} className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition ${moreIsCurrent || isMoreOpen ? "bg-[var(--accent)]/15 text-[var(--primary)]" : "text-[var(--foreground)]/80 hover:bg-[var(--accent)]/10"}`} title="Más opciones"><MoreHorizontal className="h-5 w-5" /><span className="sr-only">Más opciones</span></button>
        {isMoreOpen ? <div role="menu" className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_16px_40px_rgba(14,75,78,0.16)]">
          <Link role="menuitem" href="/panel/estadisticas" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-[var(--accent)]/10"><BarChart3 className="h-4 w-4 text-[var(--accent)]" />Estadísticas</Link>
          <Link role="menuitem" href="/panel/historial" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-[var(--accent)]/10"><ClipboardList className="h-4 w-4 text-[var(--accent)]" />Historial</Link>
          <Link role="menuitem" href="/panel/mi-perfil" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-[var(--accent)]/10"><Stethoscope className="h-4 w-4 text-[var(--accent)]" />Mi perfil</Link>
          <button type="button" role="menuitem" onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut className="h-4 w-4" />Cerrar sesión</button>
        </div> : null}
      </div>
    </nav>

    <nav aria-label="Navegación móvil del panel médico" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--card)] px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(14,75,78,0.1)] md:hidden">
      {primaryItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ${isCurrent(pathname, href) ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}><Icon className="h-5 w-5" />{label}</Link>)}
      <button type="button" aria-expanded={isMoreOpen} onClick={() => setIsMoreOpen((open) => !open)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium ${moreIsCurrent || isMoreOpen ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}><MoreHorizontal className="h-5 w-5" />Más</button>
    </nav>
    {isMoreOpen ? <div className="fixed inset-x-4 bottom-20 z-40 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_16px_40px_rgba(14,75,78,0.2)] md:hidden">
      <Link href="/panel/estadisticas" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm"><BarChart3 className="h-4 w-4 text-[var(--accent)]" />Estadísticas</Link>
      <Link href="/panel/historial" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm"><ClipboardList className="h-4 w-4 text-[var(--accent)]" />Historial</Link>
      <Link href="/panel/mi-perfil" onClick={() => setIsMoreOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-3 text-sm"><Stethoscope className="h-4 w-4 text-[var(--accent)]" />Mi perfil</Link>
      <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-red-700"><LogOut className="h-4 w-4" />Cerrar sesión</button>
    </div> : null}
  </>;
}