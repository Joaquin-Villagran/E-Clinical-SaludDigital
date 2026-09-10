import { redirect } from "next/navigation";
import { getAuthorizedTeleconsulta } from "@/lib/teleconsulta";
import { getServerUser } from "@/lib/supabase-server";
import TeleconsultaClosureFlow from "@/app/components/teleconsulta-closure-flow";

export default async function TeleconsultaClosurePage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "patient") redirect("/login");
  const access = await getAuthorizedTeleconsulta(appointmentId, "patient");
  if (access.state === "forbidden" || !access.turno) redirect("/mi-cuenta");
  return <TeleconsultaClosureFlow appointmentId={appointmentId} />;
}
