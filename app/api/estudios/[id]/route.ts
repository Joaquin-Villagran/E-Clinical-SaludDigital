import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const validCategorias = ["laboratorio", "imagen", "cardiologia", "otro"];

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
  const updates: Record<string, string | null | boolean> = {};

  if (Object.prototype.hasOwnProperty.call(body, "paciente_id")) {
    const pacienteId = body.paciente_id?.toString().trim();
    if (!pacienteId) {
      return NextResponse.json({ error: "El paciente es obligatorio." }, { status: 400 });
    }
    updates.paciente_id = pacienteId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "consulta_id")) {
    updates.consulta_id = body.consulta_id?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "paciente_email")) {
  }

  if (Object.prototype.hasOwnProperty.call(body, "titulo")) {
    const titulo = body.titulo?.toString().trim();
    if (!titulo) {
      return NextResponse.json({ error: "El titulo es obligatorio." }, { status: 400 });
    }
    updates.titulo = titulo;
  }

  if (Object.prototype.hasOwnProperty.call(body, "categoria")) {
    const categoria = body.categoria?.toString().trim();
    if (!categoria || !validCategorias.includes(categoria)) {
      return NextResponse.json({ error: "Categoria invalida." }, { status: 400 });
    }
    updates.categoria = categoria;
  }

  if (Object.prototype.hasOwnProperty.call(body, "fecha")) {
    const fecha = body.fecha?.toString().trim();
    if (!fecha) {
      return NextResponse.json({ error: "La fecha es obligatoria." }, { status: 400 });
    }
    updates.fecha = fecha;
  }

  if (Object.prototype.hasOwnProperty.call(body, "archivo_url")) {
    updates.archivo_url = body.archivo_url?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "file_url")) {
    updates.archivo_url = body.file_url?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "es_descargable")) {
    updates.es_descargable = Boolean(body.es_descargable);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const result = await supabase.from("estudios").update(updates).eq("id", id).select().maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estudio: result.data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("estudios").delete().eq("id", id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
