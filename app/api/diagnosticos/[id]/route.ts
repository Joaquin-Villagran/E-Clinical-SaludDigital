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
  const updates: Record<string, string | null> = {};

  if (Object.prototype.hasOwnProperty.call(body, "consulta_id")) {
    const consultaId = body.consulta_id?.toString().trim();
    if (!consultaId) {
      return NextResponse.json({ error: "La consulta es obligatoria." }, { status: 400 });
    }
    updates.consulta_id = consultaId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "paciente_id")) {
    const pacienteId = body.paciente_id?.toString().trim();
    if (!pacienteId) {
      return NextResponse.json({ error: "El paciente es obligatorio." }, { status: 400 });
    }
    updates.paciente_id = pacienteId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "descripcion")) {
    const descripcion = body.descripcion?.toString().trim();
    if (!descripcion) {
      return NextResponse.json({ error: "La descripcion es obligatoria." }, { status: 400 });
    }
    updates.descripcion = descripcion;
  }

  if (Object.prototype.hasOwnProperty.call(body, "codigo_cie10")) {
    updates.codigo_cie10 = body.codigo_cie10?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "fecha")) {
    const fecha = body.fecha?.toString().trim();
    if (!fecha) {
      return NextResponse.json({ error: "La fecha es obligatoria." }, { status: 400 });
    }
    updates.fecha = fecha;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const result = await supabase.from("diagnosticos").update(updates).eq("id", id).select().maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, diagnostico: result.data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("diagnosticos").delete().eq("id", id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
