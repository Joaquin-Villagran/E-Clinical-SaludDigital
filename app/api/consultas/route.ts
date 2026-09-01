import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session?.user || session.user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const body = await request.json();
  const pacienteId = body.paciente_id?.toString().trim();
  const fecha = body.fecha?.toString().trim();
  const profesionalId = body.profesional_id?.toString().trim() || null;
  const motivoConsulta = body.motivo_consulta?.toString().trim() ?? null;
  const examenFisico = body.examen_fisico?.toString().trim() ?? null;
  const observaciones = body.observaciones?.toString().trim() ?? null;

  if (!pacienteId || !fecha) {
    return NextResponse.json({ error: "Paciente y fecha son campos obligatorios." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const insertResult = await supabase
    .from("consultas")
    .insert([
      {
        paciente_id: pacienteId,
        profesional_id: profesionalId,
        fecha,
        motivo_consulta: motivoConsulta,
        examen_fisico: examenFisico,
        observaciones,
      },
    ])
    .select()
    .maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, consulta: insertResult.data }, { status: 201 });
}
