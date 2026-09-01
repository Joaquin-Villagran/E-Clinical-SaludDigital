import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const validTipos = ["patologico_personal", "familiar", "alergia", "quirurgico", "habito"];

async function ensureDoctorRole() {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  return session?.user && session.user.user_metadata?.role === "doctor";
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const updates: Record<string, string | null> = {};

  if (Object.prototype.hasOwnProperty.call(body, "tipo")) {
    const tipo = body.tipo?.toString().trim();
    if (!tipo || !validTipos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de antecedente invalido." }, { status: 400 });
    }
    updates.tipo = tipo;
  }

  if (Object.prototype.hasOwnProperty.call(body, "titulo")) {
    const titulo = body.titulo?.toString().trim();
    updates.titulo = titulo || "Antecedente";
  }

  if (Object.prototype.hasOwnProperty.call(body, "descripcion")) {
    const descripcion = body.descripcion?.toString().trim();
    updates.descripcion = descripcion || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "fecha_registro")) {
    const fechaRegistro = body.fecha_registro?.toString().trim();
    if (!fechaRegistro) {
      return NextResponse.json({ error: "La fecha de registro es obligatoria." }, { status: 400 });
    }
    updates.fecha_registro = fechaRegistro;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const result = await supabase.from("antecedentes").update(updates).eq("id", id).select().maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, antecedente: result.data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("antecedentes").delete().eq("id", id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
