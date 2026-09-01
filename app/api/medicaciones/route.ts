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
  const consultaId = body.consulta_id?.toString().trim() || null;
  const nombreMedicamento = body.nombre_medicamento?.toString().trim();
  const dosis = body.dosis?.toString().trim() ?? null;
  const frecuencia = body.frecuencia?.toString().trim() ?? null;
  const fechaInicio = body.fecha_inicio?.toString().trim() || null;
  const fechaFin = body.fecha_fin?.toString().trim() || null;
  const activa = typeof body.activa === "boolean" ? body.activa : true;

  if (!pacienteId || !nombreMedicamento) {
    return NextResponse.json({ error: "Paciente y nombre del medicamento son obligatorios." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const insertResult = await supabase
    .from("medicaciones")
    .insert([
      {
        paciente_id: pacienteId,
        consulta_id: consultaId,
        nombre_medicamento: nombreMedicamento,
        dosis,
        frecuencia,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        activa,
      },
    ])
    .select()
    .maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, medicacion: insertResult.data }, { status: 201 });
}
