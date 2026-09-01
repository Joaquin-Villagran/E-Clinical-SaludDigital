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
  const consultaId = body.consulta_id?.toString().trim();
  const descripcion = body.descripcion?.toString().trim();
  const codigoCie10 = body.codigo_cie10?.toString().trim() ?? null;
  const fecha = body.fecha?.toString().trim() || new Date().toISOString().slice(0, 10);

  if (!pacienteId || !consultaId || !descripcion) {
    return NextResponse.json({ error: "Paciente, consulta y descripción son obligatorios." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const insertResult = await supabase
    .from("diagnosticos")
    .insert([
      {
        paciente_id: pacienteId,
        consulta_id: consultaId,
        descripcion,
        codigo_cie10: codigoCie10,
        fecha,
      },
    ])
    .select()
    .maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, diagnostico: insertResult.data }, { status: 201 });
}
