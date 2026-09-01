import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const validTipos = ["patologico_personal", "familiar", "alergia", "quirurgico", "habito"];

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
  const tipo = body.tipo?.toString().trim();
  const titulo = body.titulo?.toString().trim() || "Antecedente";
  const descripcion = body.descripcion?.toString().trim() ?? null;
  const fechaRegistro = body.fecha_registro?.toString().trim() || new Date().toISOString().slice(0, 10);

  if (!pacienteId || !tipo) {
    return NextResponse.json({ error: "Paciente y tipo son campos obligatorios." }, { status: 400 });
  }

  if (!validTipos.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de antecedente inválido." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const insertResult = await supabase.from("antecedentes").insert([
    {
      paciente_id: pacienteId,
      tipo,
      titulo,
      descripcion: descripcion || null,
      fecha_registro: fechaRegistro,
    },
  ]).select().maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, antecedente: insertResult.data }, { status: 201 });
}
