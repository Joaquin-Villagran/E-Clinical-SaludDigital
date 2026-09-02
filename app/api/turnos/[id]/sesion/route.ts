import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase-server";
import { getAuthorizedTeleconsulta } from "@/lib/teleconsulta";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authorized = await getAuthorizedTeleconsulta(id, "doctor");
  if (authorized.state === "forbidden" || !authorized.turno) {
    return NextResponse.json({ error: "No tenés acceso a esta sesión." }, { status: 403 });
  }
  if (authorized.state !== "active") {
    return NextResponse.json({ error: "La sesión no está habilitada en este horario." }, { status: 409 });
  }

  const body = await request.json();
  if (body.action !== "iniciar" && body.action !== "finalizar") {
    return NextResponse.json({ error: "Acción de sesión inválida." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const updates = body.action === "iniciar"
    ? { fecha_hora_inicio_real: authorized.turno.fecha_hora_inicio_real ?? now }
    : { fecha_hora_fin_real: now };
  const result = await supabase.from("turnos").update(updates).eq("id", id).select("fecha_hora_inicio_real, fecha_hora_fin_real").maybeSingle();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  return NextResponse.json({ ok: true, turno: result.data });
}