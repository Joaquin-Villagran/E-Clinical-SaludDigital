import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const server = await createServerSupabase();
  const { data: { session } } = await server.auth.getSession();
  if (!session?.user || session.user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const body = await request.json();
  const turnoId = typeof body.turno_id === "string" ? body.turno_id.trim() : "";
  if (!turnoId) return NextResponse.json({ error: "El turno es obligatorio." }, { status: 400 });

  const supabase = createAdminSupabase();
  const doctor = await supabase.from("doctors").select("id").eq("user_id", session.user.id).maybeSingle();
  if (doctor.error || !doctor.data) return NextResponse.json({ error: "No se encontró el perfil profesional." }, { status: 403 });

  const turno = await supabase
    .from("turnos")
    .select("id, paciente_id, doctor_id, fecha_preferida, hora_preferida, motivo, tipo_consulta, estado")
    .eq("id", turnoId)
    .eq("doctor_id", doctor.data.id)
    .maybeSingle();
  if (turno.error) return NextResponse.json({ error: turno.error.message }, { status: 500 });
  if (!turno.data?.paciente_id) return NextResponse.json({ error: "El turno no tiene una ficha clínica vinculada." }, { status: 409 });

  const existing = await supabase
    .from("consultas")
    .select("*")
    .eq("turno_id", turnoId)
    .maybeSingle();
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  if (existing.data) return NextResponse.json({ ok: true, created: false, consulta: existing.data });

  const result = await supabase.from("consultas").insert({
    paciente_id: turno.data.paciente_id,
    turno_id: turnoId,
    profesional_id: doctor.data.id,
    fecha: turno.data.fecha_preferida,
    motivo_consulta: turno.data.motivo,
    observaciones: `Agenda: ${turno.data.fecha_preferida} a las ${String(turno.data.hora_preferida).slice(0, 5)} hs. Modalidad: ${turno.data.tipo_consulta === "videoconsulta" ? "Teleconsulta" : "Consulta presencial"}. Estado inicial: ${turno.data.estado}.`,
    metadata: {
      turno_id: turnoId,
      hora_agendada: turno.data.hora_preferida,
      modalidad: turno.data.tipo_consulta,
      modalidad_atencion: turno.data.tipo_consulta,
      estado_turno: turno.data.estado,
    },
  }).select().single();

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: true, consulta: result.data }, { status: 201 });
}
