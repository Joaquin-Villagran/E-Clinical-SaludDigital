import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

const editableFields = [
  "nombre",
  "apellido",
  "dni",
  "fecha_nacimiento",
  "sexo",
  "direccion",
  "telefono",
  "obra_social",
  "numero_afiliado",
  "contacto_emergencia_nombre",
  "contacto_emergencia_telefono",
] as const;

export async function GET() {
  const server = await createServerSupabase();
  const { data: { session } } = await server.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const supabase = server as unknown as SupabaseClient;
  let result = await supabase.from("pacientes").select("*").eq("user_id", session.user.id).maybeSingle();
  if (!result.data && session.user.email) {
    result = await supabase.from("pacientes").select("*").ilike("email", session.user.email).maybeSingle();
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ paciente: result.data });
}

export async function PATCH(request: NextRequest) {
  const server = await createServerSupabase();
  const { data: { session } } = await server.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, string | null> = {};
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = typeof body[field] === "string" && body[field].trim() ? body[field].trim() : null;
    }
  }
  if (!updates.nombre || !updates.apellido || !updates.dni) {
    return NextResponse.json({ error: "Nombre, apellido y DNI son obligatorios." }, { status: 400 });
  }

  const supabase = server as unknown as SupabaseClient;
  let current = await supabase.from("pacientes").select("id").eq("user_id", session.user.id).maybeSingle();
  if (!current.data && session.user.email) {
    current = await supabase.from("pacientes").select("id").ilike("email", session.user.email).maybeSingle();
  }
  const currentPatientId = (current.data as unknown as { id: string } | null)?.id;
  const patientUpdates = { ...updates, email: session.user.email ?? null } as Database["public"]["Tables"]["pacientes"]["Update"];
  const result = currentPatientId
    ? await supabase.from("pacientes").update({ ...patientUpdates, user_id: session.user.id }).eq("id", currentPatientId).select().single()
    : await supabase.from("pacientes").insert({ ...patientUpdates, user_id: session.user.id } as Database["public"]["Tables"]["pacientes"]["Insert"]).select().single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paciente: result.data });
}
