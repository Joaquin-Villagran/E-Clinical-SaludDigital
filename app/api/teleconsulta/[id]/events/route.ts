import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";
import { getAuthorizedTeleconsulta } from "@/lib/teleconsulta";

type Context = { params: Promise<{ id: string }> };
type Action = "join" | "leave" | "start" | "finish";

export async function POST(request: NextRequest, context: Context) {
  const user = await getServerUser();
  const role = user?.user_metadata?.role === "doctor" || user?.user_metadata?.role === "patient" ? user.user_metadata.role : null;
  if (!user || !role) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { id } = await context.params;
  const authorized = await getAuthorizedTeleconsulta(id, role);
  if (!authorized.turno || authorized.state === "forbidden") return NextResponse.json({ error: "No tenés acceso a esta teleconsulta." }, { status: 403 });
  if (authorized.state !== "active") return NextResponse.json({ error: "La sala no está disponible en este horario." }, { status: 409 });

  let body: { action?: Action };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 }); }
  if (!body.action || !["join", "leave", "start", "finish"].includes(body.action)) return NextResponse.json({ error: "Evento de sala inválido." }, { status: 400 });
  if ((body.action === "start" || body.action === "finish") && role !== "doctor") return NextResponse.json({ error: "Sólo el médico puede modificar el estado de la consulta." }, { status: 403 });

  const now = new Date().toISOString();
  const supabase = createAdminSupabase();
  if (body.action === "finish" && authorized.turno.paciente_id && authorized.turno.doctor_id) {
    const schemaCheck = await supabase.from("information_schema.columns").select("column_name").eq("table_schema", "public").eq("table_name", "consultas").eq("column_name", "turno_id").maybeSingle();
    const hasTurnoIdColumn = Boolean(schemaCheck.data);
    const existingConsultas = await supabase.from("consultas").select("id, turno_id, metadata").eq("paciente_id", authorized.turno.paciente_id).limit(50);
    if (existingConsultas.error) return NextResponse.json({ error: "No se pudo verificar la consulta clínica." }, { status: 500 });
    const existingConsulta = (existingConsultas.data ?? []).find((consulta) => {
      const metadata = consulta.metadata && typeof consulta.metadata === "object" && !Array.isArray(consulta.metadata) ? consulta.metadata as Record<string, unknown> : {};
      return consulta.turno_id === id || String(metadata.turno_id ?? "") === id;
    });
    if (!existingConsulta) {
      const consultaPayload: Record<string, unknown> = {
        paciente_id: authorized.turno.paciente_id,
        profesional_id: authorized.turno.doctor_id,
        fecha: authorized.turno.fecha_preferida,
        motivo_consulta: authorized.turno.motivo,
        metadata: { turno_id: id, modalidad: authorized.turno.tipo_consulta, estado_turno: "finalizado" },
      };
      if (hasTurnoIdColumn) consultaPayload.turno_id = id;
      const createdConsulta = await supabase.from("consultas").insert(consultaPayload).select("id").maybeSingle();
      if (createdConsulta.error) return NextResponse.json({ error: "No se pudo crear la consulta clínica." }, { status: 500 });
    }
  }
  const updates = body.action === "start"
    ? { video_started_at: authorized.turno.video_started_at ?? now, video_status: "in_progress", fecha_hora_inicio_real: authorized.turno.fecha_hora_inicio_real ?? now, estado: "en_consulta" }
    : body.action === "finish"
      ? { video_ended_at: now, video_status: "completed", fecha_hora_fin_real: now, estado: "finalizado" }
      : body.action === "join" && authorized.turno.video_status === "pending"
        ? { video_status: "waiting" }
        : {};
  if (Object.keys(updates).length) {
    const result = await supabase.from("turnos").update(updates).eq("id", id);
    if (result.error) return NextResponse.json({ error: "No se pudo actualizar el estado de la teleconsulta." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, action: body.action, status: updates.video_status ?? authorized.turno.video_status });
}