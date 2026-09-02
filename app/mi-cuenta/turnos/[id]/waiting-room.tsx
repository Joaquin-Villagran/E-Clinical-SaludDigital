"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

type Props = { sessionHref: string; scheduledStart: string; enabled: boolean; meetLink: string | null };

function remainingTime(scheduledStart: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(scheduledStart).getTime() - 10 * 60_000 - now) / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function WaitingRoom({ sessionHref, scheduledStart, enabled, meetLink }: Props) {
  const [now, setNow] = useState(0);
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
  const waiting = !enabled && !now ? "--:--:--" : remainingTime(scheduledStart, now);
  return <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_36px_rgba(14,75,78,0.08)]"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Sala de espera</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">Tu teleconsulta</h1>{enabled ? <><p className="mt-4 text-sm text-[var(--muted)]">La sala está habilitada.</p>{meetLink ? <Link href={sessionHref} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4" />Ingresar a la consulta</Link> : <p className="mt-5 rounded-md bg-[var(--accent)]/10 p-4 text-sm text-[var(--primary)]">El profesional todavía no compartió el link, actualizá en unos minutos.</p>}</> : <><p className="mt-5 font-mono text-4xl font-semibold text-[var(--primary)]">{waiting}</p><p className="mt-2 text-sm text-[var(--muted)]">La sala se habilita 10 minutos antes del horario de tu turno.</p></>}</section>;
}