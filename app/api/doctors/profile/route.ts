import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

const sectionFields = {
  personales: ["nombre", "documento", "fecha_nacimiento", "sexo", "nacionalidad"],
  contacto: ["telefono", "direccion", "ciudad", "provincia", "foto_url"],
  profesional: ["matricula", "tipo_matricula", "especialidad"],
} as const;

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function validExternalUrl(value: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// Cada sección tiene una lista cerrada de campos para que no se puedan modificar campos fuera del formulario elegido.
export async function PATCH(request: NextRequest) {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const body = await request.json();
  const section = body.section as keyof typeof sectionFields | undefined;
  if (!section || !(section in sectionFields)) {
    return NextResponse.json({ error: "Sección de perfil inválida." }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  for (const field of sectionFields[section]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) updates[field] = optionalText(body[field]);
  }
  if (section === "contacto" && !validExternalUrl(updates.foto_url ?? null)) {
    return NextResponse.json({ error: "La foto debe ser una URL externa válida." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  if (section === "personales") {
    const fullName = updates.nombre?.trim() ?? "";
    const documentNumber = (updates.documento ?? "").replace(/\D/g, "");
    if (!fullName || !/^\d{7,8}$/.test(documentNumber)) {
      return NextResponse.json({ error: "Ingresá un nombre y un DNI válido de 7 u 8 dígitos." }, { status: 400 });
    }
    updates.nombre = fullName;
    updates.documento = documentNumber;
    const nameParts = fullName?.split(/\s+/) ?? [];
    const userResult = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        full_name: fullName,
        first_name: nameParts[0] ?? null,
        last_name: nameParts.slice(1).join(" ") || null,
        documento: updates.documento,
        fecha_nacimiento: updates.fecha_nacimiento,
        sexo: updates.sexo,
        nacionalidad: updates.nacionalidad,
      },
    });
    if (userResult.error) return NextResponse.json({ error: userResult.error.message }, { status: 409 });
  }
  const result = await supabase.from("doctors").update(updates).eq("user_id", user.id).select().maybeSingle();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "No se encontró el perfil profesional." }, { status: 404 });

  return NextResponse.json({ ok: true, doctor: result.data });
}