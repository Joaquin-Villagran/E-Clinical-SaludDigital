import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

const editableFields = [
  "nombre",
  "apellido",
  "dni",
  "fecha_nacimiento",
  "sexo",
  "direccion",
  "telefono",
  "email",
  "obra_social",
  "numero_afiliado",
  "contacto_emergencia_nombre",
  "contacto_emergencia_telefono",
] as const;

type EditableField = (typeof editableFields)[number];

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session?.user || session.user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const params = await context.params;
  const supabase = createAdminSupabase();
  const result = await supabase.from("pacientes").select("*").eq("id", params.id).maybeSingle();

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, paciente: result.data });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session?.user || session.user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const params = await context.params;
  const patientId = params.id;
  const body = await request.json();
  const updates: Record<string, string | null> = {};

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field] === "" ? null : body[field];
    }
  }

  if (!updates.nombre || !updates.apellido || !updates.dni) {
    return NextResponse.json(
      { error: "Nombre, apellido y DNI son obligatorios para actualizar el paciente." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabase();
  const updateResult = await supabase
    .from("pacientes")
    .update(updates)
    .eq("id", patientId)
    .select()
    .maybeSingle();

  if (updateResult.error) {
    return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paciente: updateResult.data });
}
