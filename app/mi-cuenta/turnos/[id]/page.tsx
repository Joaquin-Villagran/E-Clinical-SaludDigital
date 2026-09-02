import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import WaitingRoom from "./waiting-room";
import { getAuthorizedTeleconsulta, validMeetLink } from "@/lib/teleconsulta";

export default async function PatientWaitingRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getAuthorizedTeleconsulta(id, "patient");
  if (session.state === "forbidden" || !session.turno) redirect("/mi-cuenta");
  if (session.state === "unavailable") return <main className="min-h-screen bg-[var(--background)]"><SiteHeader /><p className="container mx-auto px-6 py-20 text-lg text-[var(--primary)]">Esta sala sólo está disponible para turnos de videoconsulta confirmados.</p></main>;
  if (session.state === "finished") return <main className="min-h-screen bg-[var(--background)]"><SiteHeader /><p className="container mx-auto px-6 py-20 text-lg text-[var(--primary)]">Esta teleconsulta ya finalizó.</p></main>;
  const scheduledStart = `${session.turno.fecha_preferida}T${session.turno.hora_preferida.length === 5 ? `${session.turno.hora_preferida}:00` : session.turno.hora_preferida}-03:00`;
  return <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-3xl px-6 py-12"><WaitingRoom sessionHref={`/mi-cuenta/turnos/${id}/sesion`} scheduledStart={scheduledStart} enabled={session.state === "active"} meetLink={validMeetLink(session.turno.meet_link)} /></section></main>;
}