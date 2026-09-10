import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

type EstudioRow = {
  id: string;
  paciente_id: string | null;
  consulta_id: string | null;
  titulo: string;
  categoria: string;
  fecha: string;
  archivo_url: string | null;
  es_descargable: boolean;
  created_at: string;
};

// Agrega en una sola llamada todo lo que necesita la ficha clínica completa (mismas columnas que /panel/pacientes/[id]).
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminSupabase();

  const patientResult = await supabase
    .from("pacientes")
    .select(
      "id, user_id, nombre, apellido, dni, fecha_nacimiento, sexo, direccion, telefono, email, obra_social, numero_afiliado, contacto_emergencia_nombre, contacto_emergencia_telefono, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (patientResult.error) {
    return NextResponse.json({ error: patientResult.error.message }, { status: 500 });
  }
  if (!patientResult.data) {
    return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
  }

  const doctorResult = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
  const patient = patientResult.data;
  const turnosByPatient = await supabase
    .from("turnos")
    .select("id, doctor_id, fecha_preferida, hora_preferida, motivo, tipo_consulta, estado")
    .eq("paciente_id", id)
    .order("fecha_preferida", { ascending: false });
  const turnosByUser = patient.user_id
    ? await supabase.from("turnos").select("id, doctor_id, fecha_preferida, hora_preferida, motivo, tipo_consulta, estado").eq("paciente_user_id", patient.user_id).order("fecha_preferida", { ascending: false })
    : { data: [] };
  const turnosByEmail = patient.email
    ? await supabase.from("turnos").select("id, doctor_id, fecha_preferida, hora_preferida, motivo, tipo_consulta, estado").eq("email", patient.email).order("fecha_preferida", { ascending: false })
    : { data: [] };
  const agendaTurnos = Array.from(new Map([
    ...((turnosByPatient.data ?? []) as unknown as Array<Record<string, unknown>>),
    ...((turnosByUser.data ?? []) as unknown as Array<Record<string, unknown>>),
    ...((turnosByEmail.data ?? []) as unknown as Array<Record<string, unknown>>),
  ].map((turno) => [String(turno.id), turno])).values());

  for (const turno of agendaTurnos) {
    const existing = await supabase.from("consultas").select("id").eq("turno_id", String(turno.id)).maybeSingle();
    if (!existing.error && !existing.data && (turno.doctor_id || doctorResult.data?.id)) {
      await supabase.from("consultas").insert([{
        paciente_id: id,
        turno_id: String(turno.id),
        profesional_id: turno.doctor_id ?? doctorResult.data?.id ?? null,
        fecha: String(turno.fecha_preferida),
        motivo_consulta: typeof turno.motivo === "string" ? turno.motivo : null,
        observaciones: `Agenda: ${turno.fecha_preferida} a las ${String(turno.hora_preferida).slice(0, 5)} hs. Modalidad: ${turno.tipo_consulta === "videoconsulta" ? "Teleconsulta" : "Consulta presencial"}. Estado inicial: ${turno.estado}.`,
        metadata: { turno_id: String(turno.id), hora_agendada: turno.hora_preferida, modalidad: turno.tipo_consulta, estado_turno: turno.estado },
      }]);
    }
  }

  const [antecedentesResult, consultasResult, diagnosticosResult, medicacionesResult, recetasResult, estudiosResult] = await Promise.all([
    supabase
      .from("antecedentes")
      .select("id, tipo, titulo, descripcion, fecha_registro, created_at, updated_at, paciente_id")
      .eq("paciente_id", id)
      .order("fecha_registro", { ascending: false })
      .limit(50),
    supabase
      .from("consultas")
      .select("id, paciente_id, profesional_id, fecha, motivo_consulta, examen_fisico, observaciones, metadata, created_at, updated_at")
      .eq("paciente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("diagnosticos")
      .select("id, consulta_id, paciente_id, descripcion, codigo_cie10, fecha, created_at, updated_at")
      .eq("paciente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("medicaciones")
      .select("id, paciente_id, consulta_id, nombre_medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, cronica, activa, created_at, updated_at")
      .eq("paciente_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("recetas")
      .select("id, paciente_id, consulta_id, fecha_emision, pdf_url, created_at, updated_at")
      .eq("paciente_id", id)
      .order("fecha_emision", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("estudios")
      .select("id, paciente_id, consulta_id, titulo, categoria, fecha, archivo_url, es_descargable, created_at")
      .eq("paciente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (antecedentesResult.error) return NextResponse.json({ error: antecedentesResult.error.message }, { status: 500 });
  if (consultasResult.error) return NextResponse.json({ error: consultasResult.error.message }, { status: 500 });
  if (diagnosticosResult.error) return NextResponse.json({ error: diagnosticosResult.error.message }, { status: 500 });
  if (medicacionesResult.error) return NextResponse.json({ error: medicacionesResult.error.message }, { status: 500 });
  if (recetasResult.error) return NextResponse.json({ error: recetasResult.error.message }, { status: 500 });

  const estudios: EstudioRow[] = estudiosResult.error ? [] : ((estudiosResult.data ?? []) as EstudioRow[]);
  const rawConsultas = (consultasResult.data ?? []) as Array<Record<string, unknown>>;
  const turnoIds = rawConsultas.map((consulta) => {
    const metadata = consulta.metadata && typeof consulta.metadata === "object" && !Array.isArray(consulta.metadata) ? consulta.metadata as Record<string, unknown> : {};
    return typeof metadata.turno_id === "string" ? metadata.turno_id : null;
  }).filter(Boolean) as string[];
  const turnosEstados = turnoIds.length
    ? await supabase.from("turnos").select("id, estado").in("id", turnoIds)
    : { data: [] };
  const estadoPorTurno = new Map((turnosEstados.data ?? []).map((turno) => [turno.id, turno.estado]));
  const consultas = rawConsultas.map((consulta) => {
    const metadata = consulta.metadata && typeof consulta.metadata === "object" && !Array.isArray(consulta.metadata) ? consulta.metadata as Record<string, unknown> : {};
    const turnoId = typeof metadata.turno_id === "string" ? metadata.turno_id : null;
    return { ...consulta, metadata: { ...metadata, estado_turno: turnoId ? estadoPorTurno.get(turnoId) ?? metadata.estado_turno : metadata.estado_turno } };
  });

  return NextResponse.json({
    ok: true,
    paciente: patientResult.data,
    antecedentes: antecedentesResult.data ?? [],
    consultas,
    diagnosticos: diagnosticosResult.data ?? [],
    medicaciones: medicacionesResult.data ?? [],
    recetas: recetasResult.data ?? [],
    estudios,
  });
}
