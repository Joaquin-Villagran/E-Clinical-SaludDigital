"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";

type PatientRecord = Database["public"]["Tables"]["pacientes"]["Row"];
type AntecedenteRecord = Database["public"]["Tables"]["antecedentes"]["Row"];
type ConsultaRecord = Database["public"]["Tables"]["consultas"]["Row"];
type DiagnosticoRecord = Database["public"]["Tables"]["diagnosticos"]["Row"];
type MedicacionRecord = Database["public"]["Tables"]["medicaciones"]["Row"];
type RecetaRecord = Database["public"]["Tables"]["recetas"]["Row"];
type EstudioRecord = {
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

type TurnoRecord = {
  id: string;
  fecha_preferida: string;
  hora_preferida: string;
  motivo: string | null;
  estado: string;
  obra_social: string | null;
  es_particular: boolean | null;
  created_at: string;
};

type PatientFormValues = {
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  sexo: string;
  direccion: string;
  telefono: string;
  email: string;
  obra_social: string;
  numero_afiliado: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
};

type ConsultaFormValues = {
  fecha: string;
  motivo_consulta: string;
  examen_fisico: string;
  observaciones: string;
  profesional_id: string;
};

type DiagnosticoFormValues = {
  consulta_id: string;
  descripcion: string;
  codigo_cie10: string;
  fecha: string;
};

type MedicacionFormValues = {
  consulta_id: string;
  nombre_medicamento: string;
  dosis: string;
  frecuencia: string;
  fecha_inicio: string;
  fecha_fin: string;
  activa: boolean;
};

type RecetaFormValues = {
  consulta_id: string;
  fecha_emision: string;
  pdf_url: string;
};

type EstudioFormValues = {
  consulta_id: string;
  titulo: string;
  categoria: string;
  fecha: string;
  archivo_url: string;
  es_descargable: boolean;
};

type StatusMessage = {
  type: "success" | "error" | "info";
  message: string;
};

type Props = {
  patient: PatientRecord;
  antecedentes: AntecedenteRecord[];
  consultas: ConsultaRecord[];
  diagnosticos: DiagnosticoRecord[];
  medicaciones: MedicacionRecord[];
  recetas: RecetaRecord[];
  estudios: EstudioRecord[];
  turnos?: TurnoRecord[];
  isPatientView?: boolean;
};

type TabId = "datos" | "antecedentes" | "consultas" | "diagnosticos" | "medicaciones" | "recetas" | "estudios";

const antecedenteOptions = [
  { value: "patologico_personal", label: "Patologico personal" },
  { value: "familiar", label: "Familiar" },
  { value: "alergia", label: "Alergia" },
  { value: "quirurgico", label: "Quirurgico" },
  { value: "habito", label: "Habito" },
] as const;

const estudioCategoriaOptions = ["laboratorio", "imagen", "cardiologia", "otro"];

const antecedenteCategoriaLabels: Record<string, string> = {
  patologico_personal: "Antecedentes patológicos personales",
  familiar: "Antecedentes familiares",
  alergia: "Alergias",
  quirurgico: "Cirugías previas",
  habito: "Hábitos (tabaquismo, alcohol, actividad física)",
};

function buildCategoriaAntecedentes(list: AntecedenteRecord[]) {
  const map: Record<string, { id: string | null; descripcion: string }> = {};
  for (const option of antecedenteOptions) {
    const existing = list.find((item) => item.tipo === option.value);
    map[option.value] = { id: existing?.id ?? null, descripcion: existing?.descripcion ?? "" };
  }
  return map;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toInput(value: string | null | undefined) {
  return value ?? "";
}

function toOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMedicacionesText(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [nombre_medicamento = "", dosis = "", frecuencia = "", instrucciones = ""] = line
        .split("|")
        .map((part) => part.trim());
      return { nombre_medicamento, dosis, frecuencia, instrucciones };
    })
    .filter((item) => item.nombre_medicamento);
}

export default function PatientEHRView({
  patient,
  antecedentes: initialAntecedentes,
  consultas: initialConsultas,
  diagnosticos: initialDiagnosticos,
  medicaciones: initialMedicaciones,
  recetas: initialRecetas,
  estudios: initialEstudios,
  turnos = [],
  isPatientView = false,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("datos");
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [patientValues, setPatientValues] = useState<PatientFormValues>({
    nombre: patient.nombre ?? "",
    apellido: patient.apellido ?? "",

    dni: patient.dni ?? "",
    fecha_nacimiento: toInput(patient.fecha_nacimiento),
    sexo: toInput(patient.sexo),
    direccion: toInput(patient.direccion),
    telefono: toInput(patient.telefono),
    email: toInput(patient.email),
    obra_social: toInput(patient.obra_social),
    numero_afiliado: toInput(patient.numero_afiliado),
    contacto_emergencia_nombre: toInput(patient.contacto_emergencia_nombre),
    contacto_emergencia_telefono: toInput(patient.contacto_emergencia_telefono),
  });

  const [antecedentes, setAntecedentes] = useState(initialAntecedentes);
  const [categoriaAntecedentes, setCategoriaAntecedentes] = useState(() => buildCategoriaAntecedentes(initialAntecedentes));
  const [consultas, setConsultas] = useState(initialConsultas);
  const [diagnosticos, setDiagnosticos] = useState(initialDiagnosticos);
  const [medicaciones, setMedicaciones] = useState(initialMedicaciones);
  const [recetas, setRecetas] = useState(initialRecetas);
  const [estudios, setEstudios] = useState(initialEstudios);
  const [turnosState, setTurnos] = useState(turnos);

  const [newConsulta, setNewConsulta] = useState<ConsultaFormValues>({
    fecha: todayIso(),
    motivo_consulta: "",
    examen_fisico: "",
    observaciones: "",
    profesional_id: "",
  });
  const [newDiagnostico, setNewDiagnostico] = useState<DiagnosticoFormValues>({
    consulta_id: "",
    descripcion: "",
    codigo_cie10: "",
    fecha: todayIso(),
  });
  const [newMedicacion, setNewMedicacion] = useState<MedicacionFormValues>({
    consulta_id: "",
    nombre_medicamento: "",
    dosis: "",
    frecuencia: "",
    fecha_inicio: "",
    fecha_fin: "",
    activa: true,
  });
  const [newReceta, setNewReceta] = useState<RecetaFormValues>({
    consulta_id: "",
    fecha_emision: todayIso(),
    pdf_url: "",
  });
  const [newRecetaMedicaciones, setNewRecetaMedicaciones] = useState("");
  const [recetaMedicacionesDrafts, setRecetaMedicacionesDrafts] = useState<Record<string, string>>({});
  const [newEstudio, setNewEstudio] = useState<EstudioFormValues>({
    consulta_id: "",
    titulo: "",
    categoria: "laboratorio",
    fecha: todayIso(),
    archivo_url: "",
    es_descargable: false,
  });

  const consultaOptions = useMemo(
    () => consultas.map((consulta) => ({ id: consulta.id, label: `${consulta.fecha} - ${consulta.id.slice(0, 8)}` })),
    [consultas]
  );

  async function submitJson(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const errorMessage = typeof payload.error === "string" ? payload.error : "No se pudo completar la operacion.";
      throw new Error(errorMessage);
    }
    return payload;
  }

  function showError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setStatus({ type: "error", message });
  }

  async function handleSaveCategoriaAntecedente(tipo: string) {
    const entry = categoriaAntecedentes[tipo];
    const label = antecedenteCategoriaLabels[tipo];
    const busyKey = `antecedente-${tipo}`;
    setBusyAction(busyKey);
    setStatus(null);

    try {
      if (entry.id) {
        await submitJson(`/api/antecedentes/${entry.id}`, "PATCH", { descripcion: entry.descripcion });
      } else {
        const result = await submitJson("/api/antecedentes", "POST", {
          paciente_id: patient.id,
          tipo,
          titulo: label,
          descripcion: entry.descripcion,
          fecha_registro: todayIso(),
        });
        const created = result.antecedente as AntecedenteRecord | undefined;
        if (created) {
          setCategoriaAntecedentes((current) => ({
            ...current,
            [tipo]: { id: created.id, descripcion: created.descripcion ?? "" },
          }));
          setAntecedentes((current) => [created, ...current]);
        }
      }
      setStatus({ type: "success", message: `${label} guardado correctamente.` });
      router.refresh();
    } catch (error) {
      showError(error, "No se pudo guardar el antecedente.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSavePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("save-patient");
    setStatus(null);

    if (!patientValues.nombre.trim() || !patientValues.apellido.trim() || !patientValues.dni.trim()) {
      setStatus({ type: "error", message: "Nombre, apellido y DNI son obligatorios para actualizar el paciente." });
      setBusyAction(null);
      return;
    }

    try {
      await submitJson(`/api/pacientes/${patient.id}`, "PATCH", patientValues);
      setStatus({ type: "success", message: "Datos personales actualizados." });
      router.refresh();
    } catch (error) {
      showError(error, "No se pudo actualizar el paciente.");
    } finally {
      setBusyAction(null);
    }
  }

  function renderStatus() {
    if (!status) return null;
    const classes =
      status.type === "success"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
        : status.type === "error"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-slate-300 bg-slate-50 text-slate-800";

    return <div className={`mb-6 rounded-[1.5rem] border p-4 text-sm ${classes}`}>{status.message}</div>;
  }

  function tabButton(id: TabId, label: string) {
    const active = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setActiveTab(id)}
        className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
          active
            ? "bg-[var(--primary)] text-white"
            : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)]/10"
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {tabButton("datos", "Datos personales")}
        {tabButton("antecedentes", "Antecedentes")}
        {tabButton("consultas", "Consultas")}
        {tabButton("diagnosticos", "Diagnosticos")}
        {tabButton("medicaciones", "Medicaciones")}
        {tabButton("recetas", "Recetas")}
        {tabButton("estudios", "Estudios")}
      </div>

      {renderStatus()}

      {isPatientView && (
        <div className="mb-6 rounded-[1.5rem] border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800">
          <strong>Ficha Médica Personal</strong> - Estos son tus datos médicos. Puedes ver tu información pero algunos cambios deben ser autorizados por tu profesional.
        </div>
      )}

      {activeTab === "datos" ? (
        <form onSubmit={handleSavePatient} className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Nombre</span>
              <input value={patientValues.nombre} onChange={(event) => setPatientValues((current) => ({ ...current, nombre: event.target.value }))} required className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Apellido</span>
              <input value={patientValues.apellido} onChange={(event) => setPatientValues((current) => ({ ...current, apellido: event.target.value }))} required className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">DNI</span>
              <input value={patientValues.dni} onChange={(event) => setPatientValues((current) => ({ ...current, dni: event.target.value }))} required className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Fecha de nacimiento</span>
              <input type="date" value={patientValues.fecha_nacimiento} onChange={(event) => setPatientValues((current) => ({ ...current, fecha_nacimiento: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Sexo</span>
              <input value={patientValues.sexo} onChange={(event) => setPatientValues((current) => ({ ...current, sexo: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Dirección</span>
              <input value={patientValues.direccion} onChange={(event) => setPatientValues((current) => ({ ...current, direccion: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Teléfono</span>
              <input value={patientValues.telefono} onChange={(event) => setPatientValues((current) => ({ ...current, telefono: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Email</span>
              <input type="email" value={patientValues.email} onChange={(event) => setPatientValues((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Obra social</span>
              <input value={patientValues.obra_social} onChange={(event) => setPatientValues((current) => ({ ...current, obra_social: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Número de afiliado</span>
              <input value={patientValues.numero_afiliado} onChange={(event) => setPatientValues((current) => ({ ...current, numero_afiliado: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Contacto de emergencia</span>
              <input value={patientValues.contacto_emergencia_nombre} onChange={(event) => setPatientValues((current) => ({ ...current, contacto_emergencia_nombre: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Teléfono de emergencia</span>
              <input value={patientValues.contacto_emergencia_telefono} onChange={(event) => setPatientValues((current) => ({ ...current, contacto_emergencia_telefono: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <button type="submit" disabled={busyAction === "save-patient"} className="w-fit rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-60">
            {busyAction === "save-patient" ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      ) : null}

      {activeTab === "antecedentes" ? (
        <div className="space-y-6">
          {antecedenteOptions.map((option) => {
            const entry = categoriaAntecedentes[option.value];
            const busyKey = `antecedente-${option.value}`;
            return (
              <div key={option.value} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                <span className="text-sm font-semibold text-[var(--foreground)]">{antecedenteCategoriaLabels[option.value]}</span>
                <textarea
                  rows={3}
                  value={entry.descripcion}
                  onChange={(event) =>
                    setCategoriaAntecedentes((current) => ({
                      ...current,
                      [option.value]: { ...current[option.value], descripcion: event.target.value },
                    }))
                  }
                  disabled={isPatientView}
                  placeholder="Escribí acá la información correspondiente..."
                  className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20 disabled:opacity-60"
                />
                {!isPatientView ? (
                  <button
                    type="button"
                    onClick={() => handleSaveCategoriaAntecedente(option.value)}
                    disabled={busyAction === busyKey}
                    className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-60"
                  >
                    {busyAction === busyKey ? "Guardando..." : "Guardar"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {activeTab === "consultas" ? (
        <div className="space-y-8">
          <div>
            <h3 className="mb-4 text-lg font-semibold text-[var(--primary)]">Historial de turnos</h3>
            {turnosState.length === 0 ? (
              <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5 text-center">
                <p className="text-sm text-[var(--foreground)]/60">Este paciente no registró turnos desde que se sumó a la plataforma.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {turnosState.map((turno) => (
                  <article key={turno.id} className="flex flex-col gap-2 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{turno.fecha_preferida} · {turno.hora_preferida}</p>
                      <p className="mt-1 text-sm text-[var(--foreground)]/75">{turno.motivo || "Sin motivo especificado"}</p>
                      <p className="mt-1 text-xs text-[var(--foreground)]/60">
                        {turno.es_particular ? "Particular" : turno.obra_social || "Sin obra social"}
                      </p>
                    </div>
                    <span className="w-fit rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                      {turno.estado}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold text-[var(--primary)]">Consultas registradas</h3>
            <div className="space-y-4">
              {consultas.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--foreground)]/60">No hay consultas registradas.</p>
                </div>
              ) : (
                consultas.map((consulta) => (
                  <article key={consulta.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                    <input type="date" value={consulta.fecha} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                    <textarea rows={2} value={toInput(consulta.motivo_consulta)} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                    <textarea rows={2} value={toInput(consulta.examen_fisico)} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                    <textarea rows={2} value={toInput(consulta.observaciones)} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "diagnosticos" ? (
        <div className="space-y-6">
          {diagnosticos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--foreground)]/60">No hay diagnósticos registrados.</p>
            </div>
          ) : (
            diagnosticos.map((diagnostico) => (
              <article key={diagnostico.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                <select className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled>
                  {consultaOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <input type="date" value={diagnostico.fecha} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                <textarea rows={2} value={diagnostico.descripcion} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                <input value={toInput(diagnostico.codigo_cie10)} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
              </article>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "medicaciones" ? (
        <div className="space-y-6">
          {medicaciones.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--foreground)]/60">No hay medicaciones registradas.</p>
            </div>
          ) : (
            medicaciones.map((medicacion) => (
              <article key={medicacion.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                <select className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled>
                  <option value="">Sin consulta asociada</option>
                  {consultaOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <input value={medicacion.nombre_medicamento} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={toInput(medicacion.dosis)} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                  <input value={toInput(medicacion.frecuencia)} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={toInput(medicacion.fecha_inicio)} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                  <input type="date" value={toInput(medicacion.fecha_fin)} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                  <input type="checkbox" checked={medicacion.activa} disabled />
                  Activa
                </label>
              </article>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "recetas" ? (
        <div className="space-y-6">
          {recetas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--foreground)]/60">No hay recetas registradas.</p>
            </div>
          ) : (
            recetas.map((receta) => (
              <article key={receta.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                <select className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled>
                  <option value="">Sin consulta asociada</option>
                  {consultaOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <input type="date" value={receta.fecha_emision} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                <input value={toInput(receta.pdf_url)} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
              </article>
            ))
          )}
        </div>
      ) : null}

      {activeTab === "estudios" ? (
        <div className="space-y-6">
          {estudios.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[var(--foreground)]/60">No hay estudios registrados.</p>
            </div>
          ) : (
            estudios.map((estudio) => (
              <article key={estudio.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
                <select className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled>
                  <option value="">Sin consulta asociada</option>
                  {consultaOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <input value={estudio.titulo} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled>
                    {estudioCategoriaOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <input type="date" value={estudio.fecha} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" disabled />
                </div>
                {estudio.archivo_url && (
                  <a href={estudio.archivo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--primary)] hover:underline">
                    📎 Descargar archivo
                  </a>
                )}
                <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                  <input type="checkbox" checked={estudio.es_descargable} disabled />
                  Es descargable
                </label>
              </article>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
