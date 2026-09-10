import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase-server";
import { getAuthorizedTeleconsulta, getOrCreateVideoRoom, type TeleconsultaRole } from "@/lib/teleconsulta";

type RouteContext = { params: Promise<{ id: string }> };
function getRole(user: { user_metadata?: { role?: unknown } }): TeleconsultaRole | null {
  const role = user.user_metadata?.role;
  return role === "doctor" || role === "patient" ? role : null;
}

async function authorize(context: RouteContext) {
  const user = await getServerUser();
  const role = user ? getRole(user) : null;
  if (!user || !role) return { response: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };

  const { id } = await context.params;
  const authorized = await getAuthorizedTeleconsulta(id, role);
  if (authorized.state === "forbidden" || !authorized.turno) {
    return { response: NextResponse.json({ error: "No tenés acceso a esta teleconsulta." }, { status: 403 }) };
  }
  if (authorized.state === "finished") {
    return { response: NextResponse.json({ ok: true, state: "finished", turno: authorized.turno }, { status: 200 }) };
  }
  if (authorized.state !== "active") {
    return { response: NextResponse.json({ error: "La sala no está disponible en este horario.", state: authorized.state }, { status: 409 }) };
  }

  return { user, role, turno: authorized.turno };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const access = await authorize(context);
  if ("response" in access) return access.response;
  const room = await getOrCreateVideoRoom(access.turno);

  return NextResponse.json({
    room: { id: room, domain: "meet.jit.si" },
    participant: { id: access.user.id, role: access.role },
    turn: { id: access.turno.id, patientName: access.turno.nombre, date: access.turno.fecha_preferida, time: access.turno.hora_preferida, durationMinutes: access.turno.duracion_minutos ?? 30 },
  });
}