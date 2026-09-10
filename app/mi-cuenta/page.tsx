import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import { createServerSupabase, getServerUser } from "@/lib/supabase-server";
import type { Database } from "@/lib/database.types";
import ProfileForm from "./profile-form";
import UpcomingAppointments from "./upcoming-appointments";
import TeleconsultaAccess from "./teleconsulta-access";

const quickActions = [
  { label: "Nuevo turno", href: "/turnos" },
  { label: "Mis turnos", href: "#mis-turnos" },
  { label: "Mi perfil", href: "#mi-perfil" },
  { label: "Mis estudios", href: "#mis-estudios" },
];

function formatDaysRemaining(fecha: string) {
  const target = new Date(fecha);
  const now = new Date();
  const delta = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return delta;
}

type DoctorSummary = { id: string; nombre: string | null; especialidad: string | null };
type TurnoSummary = { id: string; motivo: string; fecha_preferida: string; hora_preferida: string; estado: string; tipo_consulta: string | null; obra_social: string | null; metadata: Database["public"]["Tables"]["turnos"]["Row"]["metadata"]; doctor_id: string | null; meet_link: string | null };
type ClinicalConsultation = { id: string; fecha: string; motivo_consulta: string | null; examen_fisico: string | null; observaciones: string | null; profesional_id: string | null; metadata: Database["public"]["Tables"]["consultas"]["Row"]["metadata"] };
type ClinicalDiagnosis = { id: string; descripcion: string; codigo_cie10: string | null; fecha: string };
type ClinicalMedication = { id: string; nombre_medicamento: string; dosis: string | null; frecuencia: string | null; fecha_inicio: string | null; fecha_fin: string | null; cronica: boolean; activa: boolean };
type ClinicalPrescription = { id: string; fecha_emision: string; pdf_url: string | null };
type PrescriptionMedication = { id: string; receta_id: string; nombre_medicamento: string; dosis: string | null; frecuencia: string | null; instrucciones: string | null };
type ClinicalStudy = { id: string; titulo: string; categoria: string; fecha: string; archivo_url: string | null; es_descargable: boolean };

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No informada";
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
}

export default async function MiCuentaPage() {
  const user = await getServerUser();
  if (!user || !user.email) {
    redirect("/login");
  }

  // El médico trabaja desde el panel: esta vista contiene acciones exclusivas de pacientes.
  if (user.user_metadata?.role === "doctor") {
    redirect("/panel");
  }

  const supabase = await createServerSupabase();
  const turnoSelect = "id, motivo, fecha_preferida, hora_preferida, estado, tipo_consulta, obra_social, metadata, doctor_id, meet_link";
  const [turnosByUser, turnosByEmail] = await Promise.all([
    supabase.from("turnos").select(turnoSelect).eq("paciente_user_id", user.id).limit(40),
    supabase.from("turnos").select(turnoSelect).eq("email", user.email).limit(40),
  ]);
  if (turnosByUser.error || turnosByEmail.error) {
    throw new Error(turnosByUser.error?.message || turnosByEmail.error?.message || "No se pudo cargar el historial de turnos.");
  }
  const turnosRows = [...((turnosByUser.data ?? []) as unknown as TurnoSummary[]), ...((turnosByEmail.data ?? []) as unknown as TurnoSummary[])];
  const turnosData = Array.from(new Map(turnosRows.map((turno) => [turno.id, turno])).values())
    .sort((first, second) => `${first.fecha_preferida} ${first.hora_preferida}`.localeCompare(`${second.fecha_preferida} ${second.hora_preferida}`))
    .slice(0, 40);

  const patientResult = await supabase.from("pacientes").select("id, obra_social").eq("user_id", user.id).maybeSingle();
  const patientRecord = patientResult.data as unknown as { id: string; obra_social: string | null } | null;
  const patientId = patientRecord?.id ?? "";
  const patientObraSocial = patientRecord?.obra_social?.trim() || null;
  const [consultasResult, diagnosticosResult, medicacionesResult, recetasResult, recetaMedicacionesResult, estudiosResult] = patientId ? await Promise.all([
    supabase.from("consultas").select("id, fecha, motivo_consulta, examen_fisico, observaciones, profesional_id, metadata").eq("paciente_id", patientId).order("fecha", { ascending: false }),
    supabase.from("diagnosticos").select("id, descripcion, codigo_cie10, fecha").eq("paciente_id", patientId).order("fecha", { ascending: false }),
    supabase.from("medicaciones").select("id, nombre_medicamento, dosis, frecuencia, fecha_inicio, fecha_fin, cronica, activa").eq("paciente_id", patientId).order("created_at", { ascending: false }),
    supabase.from("recetas").select("id, fecha_emision, pdf_url").eq("paciente_id", patientId).order("fecha_emision", { ascending: false }),
    supabase.from("receta_medicaciones").select("id, receta_id, nombre_medicamento, dosis, frecuencia, instrucciones").order("created_at", { ascending: false }),
    supabase.from("estudios").select("id, titulo, categoria, fecha, archivo_url, es_descargable").eq("paciente_id", patientId).order("fecha", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const turnos = turnosData as Database["public"]["Tables"]["turnos"]["Row"][];
  const doctorIds = Array.from(new Set(turnos.map((turno) => turno.doctor_id).filter(Boolean))) as string[];
  const consultationDoctorIds = ((consultasResult.data ?? []) as Array<{ profesional_id: string | null }>).map((consulta) => consulta.profesional_id).filter(Boolean) as string[];
  const allDoctorIds = Array.from(new Set([...doctorIds, ...consultationDoctorIds]));
  const doctorsResult = allDoctorIds.length ? await supabase.from("doctors").select("id, nombre, especialidad").in("id", allDoctorIds) : { data: [] as DoctorSummary[] };
  const doctors = new Map<string, DoctorSummary>((doctorsResult.data ?? []).map((doctor) => [doctor.id, doctor]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingTurnos = turnos.filter((turno) => turno.fecha_preferida >= todayIso && !["finalizado", "cancelado", "rechazado", "no_asistio"].includes(turno.estado)).slice(0, 4);
  const consultas = (consultasResult.data ?? []) as ClinicalConsultation[];
  const diagnosticos = (diagnosticosResult.data ?? []) as ClinicalDiagnosis[];
  const medicaciones = (medicacionesResult.data ?? []) as ClinicalMedication[];
  const recetas = (recetasResult.data ?? []) as ClinicalPrescription[];
  const recetaMedicaciones = (recetaMedicacionesResult.data ?? []) as PrescriptionMedication[];
  const estudios = (estudiosResult.data ?? []) as ClinicalStudy[];
  const fullName =
    user.user_metadata?.full_name ||
    [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" ");

  const profileName = fullName || "Paciente";
  const profileDescription = "Este es tu espacio personal para ver tus próximos turnos, tus estudios recientes y tus datos personales.";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-14">
        <div className="grid gap-10">
          <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Bienvenido:</p>
            <h1 className="mt-3 text-3xl font-semibold text-[var(--primary)]">{profileName}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--foreground)]/80">
              {profileDescription}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6 text-center text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5"
              >
                {action.label}
              </a>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <section id="mis-turnos" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Mis próximos turnos</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Turnos próximos</h2>
                  </div>
                  <a href="/turnos" className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--primary)]/90">
                    Solicitar nuevo
                  </a>
                </div>

                <TeleconsultaAccess turnos={upcomingTurnos.map((turno) => ({ id: turno.id, estado: turno.estado, tipo_consulta: turno.tipo_consulta, fecha_preferida: turno.fecha_preferida, hora_preferida: turno.hora_preferida }))} />
                <UpcomingAppointments turnos={upcomingTurnos.map((turno) => ({ id: turno.id, doctorId: turno.doctor_id ?? "", fecha_preferida: turno.fecha_preferida, hora_preferida: turno.hora_preferida, estado: turno.estado, tipo_consulta: turno.tipo_consulta, motivo: turno.motivo, doctorName: doctors.get(turno.doctor_id ?? "")?.nombre ?? "Pendiente de asignación", specialty: doctors.get(turno.doctor_id ?? "")?.especialidad ?? metadataValue(turno.metadata, "especialidad") ?? "Especialidad pendiente", modality: turno.tipo_consulta === "videoconsulta" ? "Videoconsulta" : "Consulta presencial" }))} />
              </section>

              <section id="historial-turnos" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6"><p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Historial</p><h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Todos tus turnos</h2></div>
                <div className="space-y-3">{turnos.length ? turnos.map((turno) => <article key={turno.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[var(--primary)]">{turno.fecha_preferida} · {turno.hora_preferida.slice(0, 5)} hs</p><p className="mt-1 text-sm text-[var(--foreground)]/75">{doctors.get(turno.doctor_id ?? "")?.nombre ?? "Profesional pendiente"} · {doctors.get(turno.doctor_id ?? "")?.especialidad ?? metadataValue(turno.metadata, "especialidad") ?? "Especialidad pendiente"}</p></div><span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{turno.estado}</span></div><p className="mt-3 text-sm">{turno.motivo}</p><p className="mt-2 text-xs text-[var(--muted)]">{patientObraSocial || "Particular"} · {turno.tipo_consulta === "presencial" ? "Consulta presencial" : "Videoconsulta"}</p></article>) : <p className="text-sm text-[var(--foreground)]/75">Todavía no tenés turnos en tu historial.</p>}</div>
              </section>

              <section id="devoluciones-medicas" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6"><p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Devoluciones médicas</p><h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Consultas y resultados</h2><p className="mt-2 text-sm text-[var(--foreground)]/75">Notas, diagnósticos, medicaciones y recetas cargadas por tu profesional.</p></div>
                <div className="space-y-4">
                  {consultas.map((consulta) => { const doctor = doctors.get(consulta.profesional_id ?? ""); return <article key={consulta.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-[var(--accent)]">Consulta · {formatDate(consulta.fecha)}</p><h3 className="mt-1 font-semibold text-[var(--primary)]">{doctor?.nombre ?? "Profesional"} · {doctor?.especialidad ?? "Especialidad pendiente"}</h3></div>{metadataValue(consulta.metadata, "hora_agendada") ? <span className="text-xs text-[var(--muted)]">Hora: {metadataValue(consulta.metadata, "hora_agendada")}</span> : null}</div>{consulta.motivo_consulta ? <p className="mt-3 text-sm"><strong>Motivo:</strong> {consulta.motivo_consulta}</p> : null}{consulta.observaciones ? <p className="mt-2 text-sm"><strong>Observaciones:</strong> {consulta.observaciones}</p> : null}</article>; })}
                  {diagnosticos.length ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><h3 className="font-semibold text-[var(--primary)]">Diagnósticos</h3>{diagnosticos.map((diagnostico) => <div key={diagnostico.id} className="mt-3 border-t border-[var(--border)] pt-3 text-sm"><p><strong>{formatDate(diagnostico.fecha)}:</strong> {diagnostico.descripcion}</p>{diagnostico.codigo_cie10 ? <p className="mt-1 text-xs text-[var(--muted)]">Código CIE-10: {diagnostico.codigo_cie10}</p> : null}</div>)}</div> : null}
                  {medicaciones.length ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><h3 className="font-semibold text-[var(--primary)]">Medicaciones</h3>{medicaciones.map((medicacion) => <div key={medicacion.id} className="mt-3 border-t border-[var(--border)] pt-3 text-sm"><p><strong>{medicacion.nombre_medicamento}</strong> {medicacion.activa ? "· Activa" : "· Finalizada"}</p><p className="mt-1 text-[var(--foreground)]/75">{medicacion.dosis || "Dosis no informada"} · {medicacion.frecuencia || "Frecuencia no informada"}</p></div>)}</div> : null}
                  {recetas.length ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><h3 className="font-semibold text-[var(--primary)]">Recetas electrónicas y devoluciones</h3>{recetas.map((receta) => <div key={receta.id} className="mt-3 border-t border-[var(--border)] pt-3 text-sm"><p><strong>Emitida:</strong> {formatDate(receta.fecha_emision)}</p>{recetaMedicaciones.filter((item) => item.receta_id === receta.id).map((item) => <p key={item.id} className="mt-1">{item.nombre_medicamento} · {item.dosis || "Dosis no informada"} · {item.frecuencia || "Frecuencia no informada"}{item.instrucciones ? ` · ${item.instrucciones}` : ""}</p>)}{receta.pdf_url ? <a href={receta.pdf_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white">Abrir receta electrónica / devolución</a> : <p className="mt-2 text-xs text-[var(--muted)]">El profesional todavía no entregó un documento.</p>}</div>)}</div> : null}
                  {!consultas.length && !diagnosticos.length && !medicaciones.length && !recetas.length ? <p className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">Todavía no hay devoluciones médicas cargadas.</p> : null}
                </div>
              </section>

              <section id="mis-estudios" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Mis últimos estudios</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Resultados recientes</h2>
                  </div>
                  <a href="#mis-estudios" className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10">
                    Ver todos
                  </a>
                </div>

                <div className="space-y-4">
                  {estudios && estudios.length > 0 ? (
                    estudios.map((estudio) => (
                      <article key={estudio.id} className="grid gap-4 rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{estudio.categoria}</p>
                          <h3 className="mt-2 text-xl font-semibold text-[var(--primary)]">{estudio.titulo}</h3>
                          <p className="mt-3 text-sm text-[var(--foreground)]/80">{formatDate(estudio.fecha)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <a
                            href={estudio.archivo_url ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90"
                          >
                            {estudio.archivo_url ? "Abrir resultado" : "Sin archivo"}
                          </a>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6 text-sm text-[var(--foreground)]/75">
                      No hay estudios registrados todavía.
                    </div>
                  )}
                </div>
              </section>
            </div>

            <section id="mi-perfil" className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
              <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Mi perfil</p>
               
                <div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--primary)]">Tus datos personales</h3>
                  <p className="mt-2 text-sm text-[var(--foreground)]/80">Desde aquí podés actualizar tu nombre, teléfono, documento y otros datos.</p>
                  <div className="mt-4">
                    <ProfileForm />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
