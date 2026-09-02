import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session?.user || session.user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const body = await request.json();
  const nombre = body.nombre?.toString().trim();
  const apellido = body.apellido?.toString().trim();
  const dni = body.dni?.toString().trim();
  const telefono = body.telefono?.toString().trim() || null;
  const email = body.email?.toString().trim() || null;
  const obraSocial = body.obra_social?.toString().trim() || null;
  const turnoId = body.turno_id?.toString().trim();

  if (!nombre || !apellido || !dni) {
    return NextResponse.json({ error: "Nombre, apellido y DNI son obligatorios para crear el paciente." }, { status: 400 });
  }

  const supabase = createAdminSupabase();

  // El DNI y el email son únicos: si ya existe una ficha, la reutilizamos en vez de duplicarla.
  const orFilters = [`dni.eq.${dni}`];
  if (email) orFilters.push(`email.eq.${email}`);
  const existingResult = await supabase.from("pacientes").select("*").or(orFilters.join(",")).limit(1).maybeSingle();
  if (existingResult.error) {
    return NextResponse.json({ error: existingResult.error.message }, { status: 500 });
  }

  let paciente = existingResult.data;
  let isExisting = Boolean(paciente);

  if (!paciente) {
    const insertResult = await supabase
      .from("pacientes")
      .insert([{ nombre, apellido, dni, telefono, email, obra_social: obraSocial }])
      .select()
      .single();

    if (insertResult.error) {
      if (insertResult.error.code === "23505") {
        // Condición de carrera: otra solicitud creó la ficha entre la búsqueda y el insert.
        const retryResult = await supabase.from("pacientes").select("*").or(orFilters.join(",")).limit(1).maybeSingle();
        if (retryResult.error || !retryResult.data) {
          return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
        }
        paciente = retryResult.data;
        isExisting = true;
      } else {
        return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
      }
    } else {
      paciente = insertResult.data;
    }
  }

  // Vincula el turno de origen para que la teleconsulta quede asociada a la ficha (nueva o existente).
  if (turnoId) {
    const linkResult = await supabase.from("turnos").update({ paciente_id: paciente.id }).eq("id", turnoId);
    if (linkResult.error) {
      return NextResponse.json({ error: linkResult.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, paciente, existing: isExisting }, { status: isExisting ? 200 : 201 });
}
