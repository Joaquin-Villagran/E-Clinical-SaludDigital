import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

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

  if (Object.prototype.hasOwnProperty.call(body, "nombre_medicamento")) {
    const nombre = body.nombre_medicamento?.toString().trim();
    if (!nombre) {
      return NextResponse.json({ error: "El nombre del medicamento es obligatorio." }, { status: 400 });
    }
    updates.nombre_medicamento = nombre;
  }

  if (Object.prototype.hasOwnProperty.call(body, "dosis")) {
    updates.dosis = body.dosis?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "frecuencia")) {
    updates.frecuencia = body.frecuencia?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "fecha_inicio")) {
    updates.fecha_inicio = body.fecha_inicio?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "fecha_fin")) {
    updates.fecha_fin = body.fecha_fin?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "activa")) {
    updates.activa = Boolean(body.activa);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const result = await supabase.from("medicaciones").update(updates).eq("id", id).select().maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, medicacion: result.data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("medicaciones").delete().eq("id", id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
