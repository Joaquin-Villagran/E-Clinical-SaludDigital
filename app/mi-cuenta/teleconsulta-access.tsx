import Link from "next/link";
import { Video } from "lucide-react";

type Props = {
  turnos: Array<{ id: string; estado: string; tipo_consulta: string | null; fecha_preferida: string; hora_preferida: string }>;
};

export default function TeleconsultaAccess({ turnos }: Props) {
  const videoTurnos = turnos.filter((turno) => (turno.estado === "confirmado" || turno.estado === "en_consulta") && turno.tipo_consulta === "videoconsulta");
  if (!videoTurnos.length) return null;

  return <div className="mb-5 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-4">
    <p className="text-sm font-semibold text-[var(--primary)]">Tus teleconsultas</p>
    <div className="mt-3 space-y-2">
      {videoTurnos.map((turno) => <div key={turno.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"><div><p className="text-sm font-semibold text-[var(--primary)]">{turno.fecha_preferida} · {turno.hora_preferida.slice(0, 5)} hs</p><p className="text-xs text-[var(--muted)]">{turno.estado === "en_consulta" ? "Consulta en curso" : "Turno confirmado"}</p></div><Link href={`/teleconsulta/${turno.id}`} className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white"><Video className="h-4 w-4" />{turno.estado === "en_consulta" ? "Reingresar" : "Ingresar"}</Link></div>)}
    </div>
  </div>;
}
