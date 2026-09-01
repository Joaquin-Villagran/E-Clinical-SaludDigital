import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import PageTitle from "@/app/components/page-title";
import { createServerSupabase, getServerUser } from "@/lib/supabase-server";
import type { Database } from "@/lib/database.types";
import PatientEHRForm from "./patient-ehr-form";

type PatientRow = Database["public"]["Tables"]["pacientes"]["Row"];
type AntecedenteRow = Database["public"]["Tables"]["antecedentes"]["Row"];
type ConsultaRow = Database["public"]["Tables"]["consultas"]["Row"];
type DiagnosticoRow = Database["public"]["Tables"]["diagnosticos"]["Row"];
type MedicacionRow = Database["public"]["Tables"]["medicaciones"]["Row"];
type RecetaRow = Database["public"]["Tables"]["recetas"]["Row"];
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

function calculateAge(fechaNacimiento?: string | null) {
  if (!fechaNacimiento) return "No disponible";
  const birthDate = new Date(fechaNacimiento);
  if (Number.isNaN(birthDate.getTime())) return "No disponible";
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = now.getUTCDate() - birthDate.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return `${age} años`;
}

export default async function PatientEHRPage({ params }: { params: { id: string } }) {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    redirect("/login");
  }

  const supabase = await createServerSupabase();
  const patientResult = await supabase
    .from("pacientes")
    .select(
      "id, nombre, apellido, dni, fecha_nacimiento, sexo, direccion, telefono, email, obra_social, numero_afiliado, contacto_emergencia_nombre, contacto_emergencia_telefono, created_at, updated_at"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (patientResult.error) {
    throw new Error(patientResult.error.message);
  }

  if (!patientResult.data) {
    redirect("/panel/pacientes");
  }

  const patient = patientResult.data as PatientRow;

  const [antecedentesResult, consultasResult, diagnosticosResult, medicacionesResult, recetasResult] = await Promise.all([
    supabase
      .from("antecedentes")
      .select("id, tipo, titulo, descripcion, fecha_registro, created_at, updated_at, metadata, paciente_id")
      .eq("paciente_id", params.id)
      .order("fecha_registro", { ascending: false })
      .limit(50),
    supabase
      .from("consultas")
      .select("id, paciente_id, profesional_id, fecha, motivo_consulta, examen_fisico, observaciones, created_at, updated_at, metadata")
      .eq("paciente_id", params.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("diagnosticos")
      .select("id, consulta_id, paciente_id, descripcion, codigo_cie10, fecha, created_at, updated_at, metadata")
      .eq("paciente_id", params.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("medicaciones")
      .select("id, paciente_id, consulta_id, nombre_medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, activa, created_at, updated_at, metadata")
      .eq("paciente_id", params.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("recetas")
      .select("id, paciente_id, consulta_id, fecha_emision, pdf_url, created_at, updated_at, metadata")
      .eq("paciente_id", params.id)
      .order("fecha_emision", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  let estudios: EstudioRow[] = [];
  const estudiosNewResult = await supabase
    .from("estudios")
    .select("id, paciente_id, consulta_id, titulo, categoria, fecha, archivo_url, es_descargable, created_at")
    .eq("paciente_id", params.id)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);

  if (!estudiosNewResult.error) {
    estudios = (estudiosNewResult.data ?? []) as EstudioRow[];
  } else {
    const estudiosLegacyResult = await supabase
      .from("estudios")
      .select("id, titulo, categoria, fecha, file_url, created_at")
      .eq("paciente_email", patient.email ?? "")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40);

    estudios = (estudiosLegacyResult.data ?? []).map((item) => ({
      id: item.id,
      paciente_id: params.id,
      consulta_id: null,
      titulo: item.titulo,
      categoria: item.categoria,
      fecha: item.fecha,
      archivo_url: item.file_url,
      es_descargable: Boolean(item.file_url),
      created_at: item.created_at,
    })) as EstudioRow[];
  }
  const antecedentes = (antecedentesResult.data ?? []) as AntecedenteRow[];
  const consultas = (consultasResult.data ?? []) as ConsultaRow[];
  const diagnosticos = (diagnosticosResult.data ?? []) as DiagnosticoRow[];
  const medicaciones = (medicacionesResult.data ?? []) as MedicacionRow[];
  const recetas = (recetasResult.data ?? []) as RecetaRow[];

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="grid gap-8">
          <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
            <PageTitle
              title={`Ficha clínica: ${patient.nombre} ${patient.apellido}`}
              description="Revisá y actualizá la información básica del paciente, y consultá su historia clínica completa."
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
            <div className="space-y-6">
              <PatientEHRForm
                patient={patient}
                antecedentes={antecedentes}
                consultas={consultas}
                diagnosticos={diagnosticos}
                medicaciones={medicaciones}
                recetas={recetas}
                estudios={estudios}
              />
            </div>
            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <h2 className="text-xl font-semibold text-[var(--primary)]">Resumen rápido</h2>
                <div className="mt-6 space-y-4">
                  <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Paciente</p>
                    <p className="mt-3 text-sm text-[var(--foreground)]/90">{patient.nombre} {patient.apellido}</p>
                    <p className="text-sm text-[var(--foreground)]/75">DNI: {patient.dni}</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Datos clínicos</p>
                    <p className="mt-3 text-sm text-[var(--foreground)]/90">Nacimiento: {patient.fecha_nacimiento ?? "No disponible"}</p>
                    <p className="mt-1 text-sm text-[var(--foreground)]/90">Edad: {calculateAge(patient.fecha_nacimiento)}</p>
                    <p className="mt-1 text-sm text-[var(--foreground)]/90">Sexo: {patient.sexo ?? "No disponible"}</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Atajos clínicos</p>
                    <p className="mt-3 text-sm text-[var(--foreground)]/90">Consultas: {consultas.length}</p>
                    <p className="text-sm text-[var(--foreground)]/90">Diagnósticos: {diagnosticos.length}</p>
                    <p className="text-sm text-[var(--foreground)]/90">Recetas: {recetas.length}</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
