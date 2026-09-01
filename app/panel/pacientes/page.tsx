import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import { createAdminSupabase, createServerSupabase, getServerUser } from "@/lib/supabase-server";
import PatientEHRView from "./ehr-patient-view";
import type { Database } from "@/lib/database.types";

type PatientTurno = {
  id: string;
  paciente_id: string | null;
  nombre: string;
  email: string;
  telefono: string;
  motivo: string | null;
  fecha_preferida: string;
  hora_preferida: string;
  estado: string;
  obra_social: string | null;
  es_particular: boolean | null;
  created_at: string;
};

type PatientConsulta = {
  id: string;
  fecha: string;
  hora: string;
  motivo: string | null;
  examen_fisico: string | null;
  observaciones: string | null;
  created_at: string;
};

type PatientReceta = {
  id: string;
  descripcion: string | null;
  pdf_url: string | null;
  created_at: string;
};

type PatientEstudio = {
  id: string;
  titulo: string | null;
  categoria: string | null;
  fecha: string | null;
  hora: string | null;
  file_url: string | null;
  external_url: string | null;
  created_at: string;
};

type PatientAntecedente = {
  id: string;
  tipo: string | null;
  titulo: string | null;
  descripcion: string | null;
  created_at: string;
};

type PatientListItem = {
  id: string;
  user_id: string | null;
  row_id: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  created_at: string;
  source: "table" | "auth";
};

export default async function PanelPacientesPage(props: {
  searchParams?: Promise<{ q?: string; patientId?: string }> | { q?: string; patientId?: string };
}) {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") {
    redirect("/login");
  }

  const searchParams = await props.searchParams;
  const supabase = await createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const query = searchParams?.q?.toString().trim() ?? "";
  const selectedPatientId = searchParams?.patientId?.toString().trim() ?? "";

  const [todayPatientsResult, pacientesResult] = await Promise.all([
    supabase
      .from("turnos")
      .select(
        "id, paciente_id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, estado, obra_social, es_particular, created_at"
      )
      .eq("fecha_preferida", today)
      .eq("estado", "confirmado")
      .order("hora_preferida", { ascending: true })
      .limit(10),
    supabase
      .from("pacientes")
      .select("id, user_id, nombre, email, telefono, dni, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (todayPatientsResult.error || pacientesResult.error) {
    throw new Error(
      todayPatientsResult.error?.message || pacientesResult.error?.message || "Error cargando datos de pacientes"
    );
  }

  const todayPatients = (todayPatientsResult.data ?? []) as PatientTurno[];
  const tablePatients = (pacientesResult.data ?? []) as Database["public"]["Tables"]["pacientes"]["Row"][];

  const authPatients: PatientListItem[] = [];
  try {
    const adminSupabase = createAdminSupabase();
    const { data: authData, error: authError } = await adminSupabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (!authError) {
      for (const user of authData?.users ?? []) {
        const role = user.user_metadata?.role;
        if (role !== "patient" && role !== "paciente") {
          continue;
        }

        authPatients.push({
          id: user.id,
          user_id: user.id,
          row_id: null,
          nombre: [user.user_metadata?.first_name, user.user_metadata?.last_name, user.user_metadata?.full_name]
            .filter(Boolean)
            .join(" ") || user.email?.split("@")?.[0] || "Sin nombre",
          email: user.email ?? null,
          telefono: user.user_metadata?.telefono ?? null,
          dni: user.user_metadata?.dni ?? null,
          created_at: user.created_at ?? new Date().toISOString(),
          source: "auth",
        });
      }
    }
  } catch {
    // Si no hay credenciales de admin, se sigue con la tabla de pacientes.
  }

  const pacientesMap = new Map<string, PatientListItem>();
  for (const patient of [
    ...tablePatients.map((row) => ({
      id: row.id,
      user_id: row.user_id ?? null,
      row_id: row.id,
      nombre: row.nombre ?? "Sin nombre",
      email: row.email ?? null,
      telefono: row.telefono ?? null,
      dni: row.dni ?? null,
      created_at: row.created_at ?? new Date().toISOString(),
      source: "table" as const,
    })),
    ...authPatients,
  ]) {
    const mergeKey = patient.user_id ?? patient.email ?? patient.id;
    const existing = pacientesMap.get(mergeKey);

    if (!existing) {
      pacientesMap.set(mergeKey, patient);
      continue;
    }

    pacientesMap.set(mergeKey, {
      ...existing,
      ...patient,
      id: existing.id || patient.id,
      user_id: existing.user_id ?? patient.user_id,
      row_id: existing.row_id ?? patient.row_id,
      nombre: existing.nombre || patient.nombre,
      email: existing.email || patient.email,
      telefono: existing.telefono || patient.telefono,
      dni: existing.dni || patient.dni,
      created_at: existing.created_at || patient.created_at,
      source: existing.source === "table" ? existing.source : patient.source,
    });
  }

  const pacientes = Array.from(pacientesMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const normalizedQuery = query.toLowerCase();
  const searchPatients = normalizedQuery
    ? pacientes.filter((patient) => {
        const haystack = [patient.nombre, patient.email, patient.dni]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : pacientes;

  const visiblePatients = searchPatients;
  const selectedPatient = pacientes.find((patient) => patient.row_id === selectedPatientId || patient.id === selectedPatientId) ?? null;

  const selectedPatientRowId = selectedPatient?.row_id ?? selectedPatient?.id ?? null;

  // Cargar datos para ambas vistas (resumen y ficha completa)
  let patientTurnos: PatientTurno[] = [];
  let patientConsultas: PatientConsulta[] = [];
  let patientRecetas: PatientReceta[] = [];
  let patientEstudios: PatientEstudio[] = [];
  let patientAntecedentes: PatientAntecedente[] = [];

  if (selectedPatientRowId) {
    // Cargar datos básicos para resumen
    const turnosResult = await supabase
      .from("turnos")
      .select("id, fecha_preferida, hora_preferida, motivo, estado, obra_social, es_particular, created_at")
      .eq("paciente_id", selectedPatientRowId)
      .order("fecha_preferida", { ascending: false })
      .order("hora_preferida", { ascending: false })
      .limit(30);
    if (!turnosResult.error) {
      patientTurnos = turnosResult.data as PatientTurno[];
    }

    const consultasResult = await supabase
      .from("consultas")
      .select("id, fecha, hora, motivo, examen_fisico, observaciones, created_at")
      .eq("paciente_id", selectedPatientRowId)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(20);
    if (!consultasResult.error) {
      patientConsultas = consultasResult.data as PatientConsulta[];
    }

    const recetasResult = await supabase
      .from("recetas")
      .select("id, descripcion, pdf_url, created_at")
      .eq("paciente_id", selectedPatientRowId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!recetasResult.error) {
      patientRecetas = recetasResult.data as PatientReceta[];
    }

    const estudiosResult = await supabase
      .from("estudios")
      .select("id, titulo, categoria, fecha, hora, file_url, external_url, created_at")
      .eq("paciente_id", selectedPatientRowId)
      .order("fecha", { ascending: false })
      .order("hora", { ascending: false })
      .limit(20);
    if (!estudiosResult.error) {
      patientEstudios = estudiosResult.data as PatientEstudio[];
    }

    const antecedentesResult = await supabase
      .from("antecedentes")
      .select("id, tipo, titulo, descripcion, created_at")
      .eq("paciente_id", selectedPatientRowId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (!antecedentesResult.error) {
      patientAntecedentes = antecedentesResult.data as PatientAntecedente[];
    }
  }
  
  // Cargar ficha médica completa si se solicita
  let patientFull: Database["public"]["Tables"]["pacientes"]["Row"] | null = null;
  let antecedentes: Database["public"]["Tables"]["antecedentes"]["Row"][] = [];
  let consultas: Database["public"]["Tables"]["consultas"]["Row"][] = [];
  let diagnosticos: Database["public"]["Tables"]["diagnosticos"]["Row"][] = [];
  let medicaciones: Database["public"]["Tables"]["medicaciones"]["Row"][] = [];
  let recetas: Database["public"]["Tables"]["recetas"]["Row"][] = [];
  let estudios: Array<{
    id: string;
    paciente_id: string | null;
    consulta_id: string | null;
    titulo: string;
    categoria: string;
    fecha: string;
    archivo_url: string | null;
    es_descargable: boolean;
    created_at: string;
  }> = [];
  let turnosHistorial: Array<{
    id: string;
    fecha_preferida: string;
    hora_preferida: string;
    motivo: string | null;
    estado: string;
    obra_social: string | null;
    es_particular: boolean | null;
    created_at: string;
  }> = [];

  // Cargar datos completos si hay selección de paciente (ya sea por query params o por lista)
  if (selectedPatientRowId && selectedPatient) {
    // Primero intenta cargar por id (si viene de tabla pacientes)
    let patientResult = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", selectedPatientRowId)
      .maybeSingle();

    // Si no encuentra por id, intenta por user_id (si es un UUID de usuario de auth)
    if (!patientResult.data && selectedPatient.user_id) {
      patientResult = await supabase
        .from("pacientes")
        .select("*")
        .eq("user_id", selectedPatient.user_id)
        .maybeSingle();
    }

    if (patientResult.error) {
      throw new Error(`Error cargando paciente: ${patientResult.error.message}`);
    }

    patientFull = patientResult.data as Database["public"]["Tables"]["pacientes"]["Row"] | null;

    // Si no se encontró el paciente pero existe en auth, crear registro automáticamente
    if (!patientFull && selectedPatient.user_id && selectedPatient.source === "auth") {
      const createResult = await supabase
        .from("pacientes")
        .insert([
          {
            user_id: selectedPatient.user_id,
            nombre: selectedPatient.nombre || "Sin nombre",
            email: selectedPatient.email || "",
            telefono: selectedPatient.telefono || null,
            dni: selectedPatient.dni || null,
          },
        ])
        .select("*")
        .single();

      if (createResult.error) {
        throw new Error(`Error creando registro de paciente: ${createResult.error.message}`);
      }

      patientFull = createResult.data as Database["public"]["Tables"]["pacientes"]["Row"];
    }

    // Si se encontró o se creó el paciente, cargar sus datos médicos
    if (patientFull) {
      const patientId = patientFull.id;

      // Cargar entidades médicas (no-críticas, se ignoran errores)
      const antecedentesResult = await supabase
        .from("antecedentes")
        .select("*")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (!antecedentesResult.error) {
        antecedentes = antecedentesResult.data as Database["public"]["Tables"]["antecedentes"]["Row"][];
      }

      const consultasResult = await supabase
        .from("consultas")
        .select("*")
        .eq("paciente_id", patientId)
        .order("fecha", { ascending: false });
      if (!consultasResult.error) {
        consultas = consultasResult.data as Database["public"]["Tables"]["consultas"]["Row"][];
      }

      const diagnosticosResult = await supabase
        .from("diagnosticos")
        .select("*")
        .eq("paciente_id", patientId)
        .order("fecha", { ascending: false });
      if (!diagnosticosResult.error) {
        diagnosticos = diagnosticosResult.data as Database["public"]["Tables"]["diagnosticos"]["Row"][];
      }

      const medicacionesResult = await supabase
        .from("medicaciones")
        .select("*")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (!medicacionesResult.error) {
        medicaciones = medicacionesResult.data as Database["public"]["Tables"]["medicaciones"]["Row"][];
      }

      const recetasResult = await supabase
        .from("recetas")
        .select("*")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (!recetasResult.error) {
        recetas = recetasResult.data as Database["public"]["Tables"]["recetas"]["Row"][];
      }

      const estudiosResult = await supabase
        .from("estudios")
        .select("*")
        .eq("paciente_id", patientId)
        .order("created_at", { ascending: false });
      if (!estudiosResult.error && estudiosResult.data) {
        estudios = estudiosResult.data.map((e: any) => ({
          id: e.id ?? "",
          paciente_id: e.paciente_id ?? null,
          consulta_id: e.consulta_id ?? null,
          titulo: e.titulo || "",
          categoria: e.categoria || "otro",
          fecha: e.fecha || new Date().toISOString().slice(0, 10),
          archivo_url: e.archivo_url || e.file_url || null,
          es_descargable: e.es_descargable ?? false,
          created_at: e.created_at || new Date().toISOString(),
        }));
      }

      // Historial completo de turnos desde el día de registro del paciente
      const turnosHistorialResult = await supabase
        .from("turnos")
        .select("id, fecha_preferida, hora_preferida, motivo, estado, obra_social, es_particular, created_at")
        .eq("paciente_id", patientId)
        .order("fecha_preferida", { ascending: true })
        .order("hora_preferida", { ascending: true });
      if (!turnosHistorialResult.error && turnosHistorialResult.data) {
        turnosHistorial = turnosHistorialResult.data as typeof turnosHistorial;
      }
    }
  }

  // Si se solicitó ver la ficha médica completa, renderizar esa interfaz
  if (selectedPatientId && patientFull) {
    return (
      <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <SiteHeader />
        <section className="container mx-auto px-6 py-14">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[var(--primary)]">Ficha Médica</h1>
              <p className="mt-2 text-sm text-[var(--foreground)]/75">{patientFull.nombre}</p>
            </div>
            <a
              href="/panel/pacientes"
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10"
            >
              ← Volver
            </a>
          </div>
          <PatientEHRView
            patient={patientFull}
            antecedentes={antecedentes}
            consultas={consultas}
            diagnosticos={diagnosticos}
            medicaciones={medicaciones}
            recetas={recetas}
            estudios={estudios}
            turnos={turnosHistorial}
            isPatientView={false}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="grid gap-8">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
            <h1 className="text-3xl font-semibold text-[var(--primary)]">Pacientes</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--foreground)]/80">
              Buscá por nombre o DNI, y consultá la ficha médica completa de cada paciente registrado.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.7fr_0.9fr]">
            <div className="space-y-6">
              <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Buscar paciente</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Nombre o DNI</h2>
                  </div>
                </div>

                <form method="get" className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <label htmlFor="q" className="sr-only">
                    Buscar por nombre o DNI
                  </label>
                  <input
                    id="q"
                    name="q"
                    type="search"
                    defaultValue={query}
                    placeholder="Ej: María Pérez, 27123456"
                    className="h-14 rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20"
                  />
                  <button
                    type="submit"
                    className="h-14 rounded-[1.5rem] bg-[var(--primary)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90"
                  >
                    Buscar
                  </button>
                </form>

                <div className="mt-8 space-y-4">
                  <p className="text-sm text-[var(--foreground)]/75">
                    {query ? (
                      <>Resultados para <span className="font-semibold">{query}</span>.</>
                    ) : (
                      <>Mostrando todos los pacientes registrados. Seleccioná un paciente para ver su ficha clínica completa.</>
                    )}
                  </p>
                  {visiblePatients.length > 0 ? (
                    <div className="grid gap-4">
                      {visiblePatients.map((paciente) => (
                        <article
                          key={paciente.id}
                          className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-[var(--primary)]">{paciente.nombre}</h3>
                              <p className="mt-1 text-sm text-[var(--foreground)]/75">DNI: {paciente.dni ?? "No disponible"}</p>
                              <p className="text-sm text-[var(--foreground)]/75">{paciente.email}</p>
                            </div>
                            <a
                              href={`/panel/pacientes?q=${encodeURIComponent(query)}&patientId=${paciente.id}`}
                              className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10"
                            >
                              Ver ficha
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--foreground)]/75">
                      No se encontraron pacientes que coincidan con esa búsqueda.
                    </p>
                  )}
                </div>
              </section>

              {selectedPatient && patientFull ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold text-[var(--primary)]">Ficha Médica</h2>
                      <p className="mt-2 text-sm text-[var(--foreground)]/75">{patientFull.nombre}</p>
                    </div>
                    <a
                      href="/panel/pacientes"
                      className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10"
                    >
                      ← Cerrar
                    </a>
                  </div>
                  <PatientEHRView
                    patient={patientFull}
                    antecedentes={antecedentes}
                    consultas={consultas}
                    diagnosticos={diagnosticos}
                    medicaciones={medicaciones}
                    recetas={recetas}
                    estudios={estudios}
                    turnos={turnosHistorial}
                    isPatientView={false}
                  />
                </div>
              ) : selectedPatient ? (
                <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                  <p className="text-center text-sm text-[var(--foreground)]/75">Cargando ficha médica...</p>
                </section>
              ) : null}
            </div>

            <aside className="space-y-6">
              <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <h2 className="text-xl font-semibold text-[var(--primary)]">Turnos confirmados hoy</h2>
                <div className="mt-6 space-y-4">
                  {todayPatients.length > 0 ? (
                    todayPatients.map((turno) => (
                      <article key={turno.id} className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-4">
                        <p className="font-semibold text-[var(--foreground)]">{turno.nombre}</p>
                        <p className="mt-1 text-sm text-[var(--foreground)]/75">{turno.fecha_preferida} · {turno.hora_preferida}</p>
                        <p className="mt-1 text-sm text-[var(--foreground)]/75">Estado: {turno.estado}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--foreground)]/75">No hay pacientes con turnos confirmados hoy.</p>
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <h2 className="text-xl font-semibold text-[var(--primary)]">Pacientes recientes</h2>
                <div className="mt-6 space-y-4">
                  {pacientes.length > 0 ? (
                    pacientes.map((paciente) => (
                      <article key={paciente.id} className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{paciente.nombre}</p>
                            <p className="mt-1 text-sm text-[var(--foreground)]/75">{paciente.email}</p>
                          </div>
                          <a
                            href={`/panel/pacientes?patientId=${paciente.row_id || paciente.id}`}
                            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10"
                          >
                            Ver ficha
                          </a>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--foreground)]/75">Aún no hay pacientes registrados en la tabla de pacientes.</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
