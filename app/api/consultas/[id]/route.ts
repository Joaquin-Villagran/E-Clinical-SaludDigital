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

  if (Object.prototype.hasOwnProperty.call(body, "fecha")) {
    const fecha = body.fecha?.toString().trim();
    if (!fecha) {
      return NextResponse.json({ error: "La fecha es obligatoria." }, { status: 400 });
    }
    updates.fecha = fecha;
  }

  if (Object.prototype.hasOwnProperty.call(body, "motivo_consulta")) {
    updates.motivo_consulta = body.motivo_consulta?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "examen_fisico")) {
    updates.examen_fisico = body.examen_fisico?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "observaciones")) {
    updates.observaciones = body.observaciones?.toString().trim() || null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "profesional_id")) {
    updates.profesional_id = body.profesional_id?.toString().trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const result = await supabase.from("consultas").update(updates).eq("id", id).select().maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, consulta: result.data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("consultas").delete().eq("id", id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
