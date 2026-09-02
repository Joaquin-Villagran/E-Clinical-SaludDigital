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
      "id, nombre, apellido, dni, fecha_nacimiento, sexo, direccion, telefono, email, obra_social, numero_afiliado, contacto_emergencia_nombre, contacto_emergencia_telefono, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (patientResult.error) {
    return NextResponse.json({ error: patientResult.error.message }, { status: 500 });
  }
  if (!patientResult.data) {
    return NextResponse.json({ error: "Paciente no encontrado." }, { status: 404 });
  }

  const [antecedentesResult, consultasResult, diagnosticosResult, medicacionesResult, recetasResult, estudiosResult] = await Promise.all([
    supabase
      .from("antecedentes")
      .select("id, tipo, titulo, descripcion, fecha_registro, created_at, updated_at, metadata, paciente_id")
      .eq("paciente_id", id)
      .order("fecha_registro", { ascending: false })
      .limit(50),
    supabase
      .from("consultas")
      .select("id, paciente_id, profesional_id, fecha, motivo_consulta, examen_fisico, observaciones, created_at, updated_at, metadata")
      .eq("paciente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("diagnosticos")
      .select("id, consulta_id, paciente_id, descripcion, codigo_cie10, fecha, created_at, updated_at, metadata")
      .eq("paciente_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("medicaciones")
      .select("id, paciente_id, consulta_id, nombre_medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, activa, created_at, updated_at, metadata")
      .eq("paciente_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("recetas")
      .select("id, paciente_id, consulta_id, fecha_emision, pdf_url, created_at, updated_at, metadata")
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

  return NextResponse.json({
    ok: true,
    paciente: patientResult.data,
    antecedentes: antecedentesResult.data ?? [],
    consultas: consultasResult.data ?? [],
    diagnosticos: diagnosticosResult.data ?? [],
    medicaciones: medicacionesResult.data ?? [],
    recetas: recetasResult.data ?? [],
    estudios,
  });
}
