import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabaseServer = await createServerSupabase();
  const { data: { session } } = await supabaseServer.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const supabase = createAdminSupabase();
  const [doctorsResult, patientResult] = await Promise.all([
    supabase.from("doctors").select("id, nombre, especialidad, profesion").not("especialidad", "is", null).order("especialidad").order("nombre"),
    supabase.from("pacientes").select("*").eq("user_id", session.user.id).maybeSingle(),
  ]);
  if (doctorsResult.error || patientResult.error) {
    return NextResponse.json({ error: doctorsResult.error?.message || patientResult.error?.message }, { status: 500 });
  }
  return NextResponse.json({ doctors: doctorsResult.data ?? [], paciente: patientResult.data ?? null });
}

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabase();
    const {
      data: { session },
    } = await supabaseServer.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Sesión requerida para solicitar un turno." }, { status: 401 });
    }

    const body = await request.json();
    const { motivo, fecha_preferida, hora_preferida, obra_social, es_particular, especialidad, doctor_id, tipo_consulta, interconsulta_id: interconsultaId } = body;
    const user = session.user;
    const metadata = user.user_metadata ?? {};
    const supabase = createAdminSupabase();
    const patientResult = await supabase.from("pacientes").select("id, nombre, apellido, email, telefono, obra_social").eq("user_id", user.id).maybeSingle();
    if (patientResult.error) return NextResponse.json({ error: patientResult.error.message }, { status: 500 });
    const patient = patientResult.data;
    const nombre = patient ? `${patient.nombre} ${patient.apellido}`.trim() : metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || user.email || "";
    const email = patient?.email || user.email || "";
    const telefono = patient?.telefono || metadata.telefono || metadata.phone || "";
    const obraSocial = patient?.obra_social ?? obra_social ?? null;

    if (!nombre || !email || !telefono || !motivo || !fecha_preferida || !hora_preferida || !especialidad || !doctor_id || !tipo_consulta) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    if (tipo_consulta !== "videoconsulta" && tipo_consulta !== "presencial") {
      return NextResponse.json({ error: "Seleccioná videoconsulta o consulta presencial." }, { status: 400 });
    }

    const availability = await supabase.from("doctor_disponibilidades").select("id").eq("doctor_id", doctor_id).eq("fecha", fecha_preferida).eq("activo", true).lte("hora_inicio", hora_preferida).gte("hora_fin", hora_preferida).limit(1).maybeSingle();
    if (availability.error || !availability.data) return NextResponse.json({ error: "El horario elegido ya no está disponible." }, { status: 409 });
    const occupied = await supabase.from("turnos").select("id").eq("doctor_id", doctor_id).eq("fecha_preferida", fecha_preferida).eq("hora_preferida", hora_preferida).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]).maybeSingle();
    if (occupied.error) return NextResponse.json({ error: occupied.error.message }, { status: 500 });
    if (occupied.data) return NextResponse.json({ error: "El horario elegido acaba de ser reservado." }, { status: 409 });

    const { data: createdTurno, error } = await supabase.from("turnos").insert([
      {
        paciente_id: patient?.id ?? null,
        paciente_user_id: user.id,
        doctor_id,
        nombre,
        email,
        telefono,
        motivo,
        fecha_preferida,
        hora_preferida,
        obra_social: obraSocial,
        es_particular: Boolean(es_particular),
        tipo_consulta,
        estado: "pendiente",
        recordatorio_enviado: false,
        metadata: { especialidad, comentario: motivo, modalidad_solicitada: tipo_consulta },
      },
    ]).select("id, doctor_id, fecha_preferida, hora_preferida, estado, tipo_consulta, obra_social, motivo, metadata").single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (interconsultaId && createdTurno?.id) {
      await supabase.from("teleconsulta_interconsultas").update({ turno_generado: true }).eq("id", interconsultaId).eq("paciente_id", patient?.id ?? "");
    }

    const doctor = await supabase.from("doctors").select("nombre, especialidad").eq("id", doctor_id).maybeSingle();
    return NextResponse.json({ ok: true, turno: { ...createdTurno, doctor: doctor.data ?? null } }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
