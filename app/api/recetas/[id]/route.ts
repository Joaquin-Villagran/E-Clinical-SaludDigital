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

  if (Object.prototype.hasOwnProperty.call(body, "fecha_emision")) {
    const fechaEmision = body.fecha_emision?.toString().trim();
    if (!fechaEmision) {
      return NextResponse.json({ error: "La fecha de emision es obligatoria." }, { status: 400 });
    }
    updates.fecha_emision = fechaEmision;
  }

  if (Object.prototype.hasOwnProperty.call(body, "pdf_url")) {
    updates.pdf_url = body.pdf_url?.toString().trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No se enviaron campos para actualizar." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const result = await supabase.from("recetas").update(updates).eq("id", id).select().maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  if (Array.isArray(body.medicaciones)) {
    const clearResult = await supabase.from("receta_medicaciones").delete().eq("receta_id", id);
    if (clearResult.error) {
      return NextResponse.json({ error: clearResult.error.message }, { status: 500 });
    }

    const recetaItems = body.medicaciones
      .map((item: Record<string, unknown>) => ({
        receta_id: id,
        nombre_medicamento: item?.nombre_medicamento?.toString().trim() ?? "",
        dosis: item?.dosis?.toString().trim() || null,
        frecuencia: item?.frecuencia?.toString().trim() || null,
        instrucciones: item?.instrucciones?.toString().trim() || null,
      }))
      .filter((item: { nombre_medicamento: string }) => item.nombre_medicamento);

    if (recetaItems.length > 0) {
      const recetaItemsResult = await supabase.from("receta_medicaciones").insert(recetaItems);
      if (recetaItemsResult.error) {
        return NextResponse.json({ error: recetaItemsResult.error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, receta: result.data });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await ensureDoctorRole())) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("recetas").delete().eq("id", id);

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
