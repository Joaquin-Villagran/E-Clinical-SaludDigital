"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MessageSquareText } from "lucide-react";
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

type AntecedenteFormValues = {
  tipo: AntecedenteRecord["tipo"];
  titulo: string;
  descripcion: string;
  fecha_registro: string;
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
  cronica: boolean;
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
  initialActiveTab?: TabId;
};

type TabId = "datos" | "antecedentes" | "consultas" | "diagnosticos" | "medicaciones" | "recetas" | "estudios";
type ConsultaFilter = "finalizado" | "rechazado" | "cancelado" | "no_asistio" | "todas";

const antecedenteOptions = [
  { value: "patologico_personal", label: "Patologico personal" },
  { value: "familiar", label: "Familiar" },
  { value: "alergia", label: "Alergia" },
  { value: "quirurgico", label: "Quirurgico" },
  { value: "habito", label: "Habito" },
] as const;

const estudioCategoriaOptions = ["laboratorio", "imagen", "cardiologia", "otro"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toInput(value: string | null | undefined) {
  return value ?? "";
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "No informado";
  const value = (metadata as Record<string, unknown>)[key];
  return value === null || value === undefined || value === "" ? "No informado" : String(value);
}

function isCompletedConsultation(consulta: ConsultaRecord) {
  if (!consulta.metadata || typeof consulta.metadata !== "object" || Array.isArray(consulta.metadata)) return false;
  return (consulta.metadata as Record<string, unknown>).estado_turno === "finalizado";
}

function uniqueCompletedConsultations(consultas: ConsultaRecord[]) {
  const seen = new Set<string>();
  return consultas.filter((consulta) => {
    if (!isCompletedConsultation(consulta)) return false;
    const metadata = consulta.metadata as Record<string, unknown>;
    const key = typeof metadata.turno_id === "string" ? metadata.turno_id : consulta.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueConsultations(consultas: ConsultaRecord[]) {
  const seen = new Set<string>();
  return consultas.filter((consulta) => {
    const metadata = consulta.metadata && typeof consulta.metadata === "object" && !Array.isArray(consulta.metadata) ? consulta.metadata as Record<string, unknown> : {};
    const key = typeof metadata.turno_id === "string" ? metadata.turno_id : consulta.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function consultaLabel(consulta: ConsultaRecord) {
  const date = displayDate(consulta.fecha);
  const metadata = consulta.metadata && typeof consulta.metadata === "object" && !Array.isArray(consulta.metadata) ? consulta.metadata as Record<string, unknown> : {};
  const hour = typeof metadata.hora_agendada === "string" ? metadata.hora_agendada.slice(0, 5) : "";
  const turnoId = typeof metadata.turno_id === "string" ? metadata.turno_id : "";
  const reason = consulta.motivo_consulta?.trim() || "Consulta clínica";
  const shortReason = reason.length > 48 ? `${reason.slice(0, 48)}...` : reason;
  return `${turnoId ? `Turno de agenda: ${turnoId}` : `Consulta: ${consulta.id}`} · ${date}${hour ? ` · ${hour} hs` : ""} · ${shortReason}`;
}

function displayDate(value: string) {
  const dateOnly = value.slice(0, 10);
  const parsed = new Date(`${dateOnly}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? dateOnly : parsed.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

export default function PatientEHRForm({
  patient,
  antecedentes: initialAntecedentes,
  consultas: initialConsultas,
  diagnosticos: initialDiagnosticos,
  medicaciones: initialMedicaciones,
  recetas: initialRecetas,
  estudios: initialEstudios,
  initialActiveTab = "datos",
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(initialActiveTab);
  const [consultaFilter, setConsultaFilter] = useState<ConsultaFilter>("finalizado");
  const [editingSection, setEditingSection] = useState<TabId | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
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
  const [consultas, setConsultas] = useState(initialConsultas);
  const [diagnosticos, setDiagnosticos] = useState(initialDiagnosticos);
  const [medicaciones, setMedicaciones] = useState(initialMedicaciones);
  const [recetas, setRecetas] = useState(initialRecetas);
  const [estudios, setEstudios] = useState(initialEstudios);

  const [newAntecedente, setNewAntecedente] = useState<AntecedenteFormValues>({
    tipo: "patologico_personal",
    titulo: "",
    descripcion: "",
    fecha_registro: todayIso(),
  });
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
    cronica: true,
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
    () => uniqueCompletedConsultations(consultas).map((consulta) => ({ id: consulta.id, label: consultaLabel(consulta) })),
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

  async function handleSavePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("save-patient");
    setStatus(null);

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

  async function handleCreateAntecedente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-antecedente");
    setStatus(null);

    try {
      const payload = await submitJson("/api/antecedentes", "POST", {
        paciente_id: patient.id,
        tipo: newAntecedente.tipo,
        titulo: newAntecedente.titulo,
        descripcion: newAntecedente.descripcion,
        fecha_registro: newAntecedente.fecha_registro,
      });
      setAntecedentes((current) => [payload.antecedente as AntecedenteRecord, ...current]);
      setNewAntecedente((current) => ({ ...current, titulo: "", descripcion: "" }));
      setStatus({ type: "success", message: "Antecedente agregado." });
    } catch (error) {
      showError(error, "No se pudo agregar el antecedente.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateAntecedente(antecedente: AntecedenteRecord) {
    setBusyAction(`update-antecedente-${antecedente.id}`);
    setStatus(null);

    try {
      const payload = await submitJson(`/api/antecedentes/${antecedente.id}`, "PATCH", {
        tipo: antecedente.tipo,
        titulo: antecedente.titulo,
        descripcion: antecedente.descripcion,
        fecha_registro: antecedente.fecha_registro,
      });
      setAntecedentes((current) => current.map((item) => (item.id === antecedente.id ? (payload.antecedente as AntecedenteRecord) : item)));
      setStatus({ type: "success", message: "Antecedente actualizado." });
    } catch (error) {
      showError(error, "No se pudo actualizar el antecedente.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteAntecedente(id: string) {
    setBusyAction(`delete-antecedente-${id}`);
    setStatus(null);

    try {
      await submitJson(`/api/antecedentes/${id}`, "DELETE");
      setAntecedentes((current) => current.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Antecedente eliminado." });
    } catch (error) {
      showError(error, "No se pudo eliminar el antecedente.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateConsulta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-consulta");
    setStatus(null);

    try {
      const payload = await submitJson("/api/consultas", "POST", {
        paciente_id: patient.id,
        fecha: newConsulta.fecha,
        motivo_consulta: newConsulta.motivo_consulta,
        observaciones: newConsulta.observaciones,
        profesional_id: toOptional(newConsulta.profesional_id),
      });
      setConsultas((current) => [payload.consulta as ConsultaRecord, ...current]);
      setNewConsulta({ fecha: todayIso(), motivo_consulta: "", examen_fisico: "", observaciones: "", profesional_id: "" });
      setStatus({ type: "success", message: "Consulta agregada." });
    } catch (error) {
      showError(error, "No se pudo agregar la consulta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateConsulta(consulta: ConsultaRecord) {
    setBusyAction(`update-consulta-${consulta.id}`);
    setStatus(null);

    try {
      const payload = await submitJson(`/api/consultas/${consulta.id}`, "PATCH", {
        fecha: consulta.fecha,
        motivo_consulta: consulta.motivo_consulta,
        observaciones: consulta.observaciones,
        profesional_id: consulta.profesional_id,
      });
      setConsultas((current) => current.map((item) => (item.id === consulta.id ? (payload.consulta as ConsultaRecord) : item)));
      setStatus({ type: "success", message: "Consulta actualizada." });
    } catch (error) {
      showError(error, "No se pudo actualizar la consulta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteConsulta(id: string) {
    setBusyAction(`delete-consulta-${id}`);
    setStatus(null);

    try {
      await submitJson(`/api/consultas/${id}`, "DELETE");
      setConsultas((current) => current.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Consulta eliminada." });
    } catch (error) {
      showError(error, "No se pudo eliminar la consulta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateDiagnostico(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-diagnostico");
    setStatus(null);

    try {
      const payload = await submitJson("/api/diagnosticos", "POST", {
        paciente_id: patient.id,
        consulta_id: newDiagnostico.consulta_id,
        descripcion: newDiagnostico.descripcion,
        codigo_cie10: newDiagnostico.codigo_cie10,
        fecha: newDiagnostico.fecha,
      });
      setDiagnosticos((current) => [payload.diagnostico as DiagnosticoRecord, ...current]);
      setNewDiagnostico({ consulta_id: "", descripcion: "", codigo_cie10: "", fecha: todayIso() });
      setStatus({ type: "success", message: "Diagnostico agregado." });
    } catch (error) {
      showError(error, "No se pudo agregar el diagnostico.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateDiagnostico(diagnostico: DiagnosticoRecord) {
    setBusyAction(`update-diagnostico-${diagnostico.id}`);
    setStatus(null);

    try {
      const payload = await submitJson(`/api/diagnosticos/${diagnostico.id}`, "PATCH", {
        paciente_id: diagnostico.paciente_id,
        consulta_id: diagnostico.consulta_id,
        descripcion: diagnostico.descripcion,
        codigo_cie10: diagnostico.codigo_cie10,
        fecha: diagnostico.fecha,
      });
      setDiagnosticos((current) => current.map((item) => (item.id === diagnostico.id ? (payload.diagnostico as DiagnosticoRecord) : item)));
      setStatus({ type: "success", message: "Diagnostico actualizado." });
    } catch (error) {
      showError(error, "No se pudo actualizar el diagnostico.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteDiagnostico(id: string) {
    setBusyAction(`delete-diagnostico-${id}`);
    setStatus(null);

    try {
      await submitJson(`/api/diagnosticos/${id}`, "DELETE");
      setDiagnosticos((current) => current.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Diagnostico eliminado." });
    } catch (error) {
      showError(error, "No se pudo eliminar el diagnostico.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateMedicacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-medicacion");
    setStatus(null);

    try {
      const payload = await submitJson("/api/medicaciones", "POST", {
        paciente_id: patient.id,
        consulta_id: toOptional(newMedicacion.consulta_id),
        nombre_medicamento: newMedicacion.nombre_medicamento,
        dosis: newMedicacion.dosis,
        frecuencia: newMedicacion.frecuencia,
        fecha_inicio: toOptional(newMedicacion.fecha_inicio),
        fecha_fin: newMedicacion.cronica ? null : toOptional(newMedicacion.fecha_fin),
        cronica: newMedicacion.cronica,
        activa: newMedicacion.activa,
      });
      setMedicaciones((current) => [payload.medicacion as MedicacionRecord, ...current]);
      setNewMedicacion({ consulta_id: "", nombre_medicamento: "", dosis: "", frecuencia: "", fecha_inicio: "", fecha_fin: "", cronica: true, activa: true });
      setStatus({ type: "success", message: "Medicacion agregada." });
    } catch (error) {
      showError(error, "No se pudo agregar la medicacion.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateMedicacion(medicacion: MedicacionRecord) {
    setBusyAction(`update-medicacion-${medicacion.id}`);
    setStatus(null);

    try {
      const payload = await submitJson(`/api/medicaciones/${medicacion.id}`, "PATCH", {
        paciente_id: medicacion.paciente_id,
        consulta_id: medicacion.consulta_id,
        nombre_medicamento: medicacion.nombre_medicamento,
        dosis: medicacion.dosis,
        frecuencia: medicacion.frecuencia,
        fecha_inicio: medicacion.fecha_inicio,
        fecha_fin: medicacion.fecha_fin,
        cronica: medicacion.cronica,
        activa: medicacion.activa,
      });
      setMedicaciones((current) => current.map((item) => (item.id === medicacion.id ? (payload.medicacion as MedicacionRecord) : item)));
      setStatus({ type: "success", message: "Medicacion actualizada." });
    } catch (error) {
      showError(error, "No se pudo actualizar la medicacion.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteMedicacion(id: string) {
    setBusyAction(`delete-medicacion-${id}`);
    setStatus(null);

    try {
      await submitJson(`/api/medicaciones/${id}`, "DELETE");
      setMedicaciones((current) => current.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Medicacion eliminada." });
    } catch (error) {
      showError(error, "No se pudo eliminar la medicacion.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateReceta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-receta");
    setStatus(null);

    try {
      const payload = await submitJson("/api/recetas", "POST", {
        paciente_id: patient.id,
        consulta_id: toOptional(newReceta.consulta_id),
        fecha_emision: newReceta.fecha_emision,
        pdf_url: toOptional(newReceta.pdf_url),
        medicaciones: parseMedicacionesText(newRecetaMedicaciones),
      });
      setRecetas((current) => [payload.receta as RecetaRecord, ...current]);
      setNewReceta({ consulta_id: "", fecha_emision: todayIso(), pdf_url: "" });
      setNewRecetaMedicaciones("");
      setStatus({ type: "success", message: "Receta agregada." });
    } catch (error) {
      showError(error, "No se pudo agregar la receta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateReceta(receta: RecetaRecord, medicacionesText: string) {
    setBusyAction(`update-receta-${receta.id}`);
    setStatus(null);

    try {
      const payload = await submitJson(`/api/recetas/${receta.id}`, "PATCH", {
        paciente_id: receta.paciente_id,
        consulta_id: receta.consulta_id,
        fecha_emision: receta.fecha_emision,
        pdf_url: receta.pdf_url,
        medicaciones: parseMedicacionesText(medicacionesText),
      });
      setRecetas((current) => current.map((item) => (item.id === receta.id ? (payload.receta as RecetaRecord) : item)));
      setStatus({ type: "success", message: "Receta actualizada." });
    } catch (error) {
      showError(error, "No se pudo actualizar la receta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteReceta(id: string) {
    setBusyAction(`delete-receta-${id}`);
    setStatus(null);

    try {
      await submitJson(`/api/recetas/${id}`, "DELETE");
      setRecetas((current) => current.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Receta eliminada." });
    } catch (error) {
      showError(error, "No se pudo eliminar la receta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateEstudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-estudio");
    setStatus(null);

    try {
      const payload = await submitJson("/api/estudios", "POST", {
        paciente_id: patient.id,
        consulta_id: toOptional(newEstudio.consulta_id),
        titulo: newEstudio.titulo,
        categoria: newEstudio.categoria,
        fecha: newEstudio.fecha,
        archivo_url: toOptional(newEstudio.archivo_url),
        es_descargable: newEstudio.es_descargable,
      });
      if (payload.estudio) {
        setEstudios((current) => [payload.estudio as EstudioRecord, ...current]);
      }
      setNewEstudio((current) => ({ ...current, titulo: "", archivo_url: "", es_descargable: false }));
      setStatus({ type: "success", message: "Estudio agregado." });
      router.refresh();
    } catch (error) {
      showError(error, "No se pudo agregar el estudio.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateEstudio(estudio: EstudioRecord) {
    setBusyAction(`update-estudio-${estudio.id}`);
    setStatus(null);

    try {
      const payload = await submitJson(`/api/estudios/${estudio.id}`, "PATCH", {
        paciente_id: estudio.paciente_id,
        consulta_id: estudio.consulta_id,
        titulo: estudio.titulo,
        categoria: estudio.categoria,
        fecha: estudio.fecha,
        archivo_url: estudio.archivo_url,
        es_descargable: estudio.es_descargable,
      });
      setEstudios((current) => current.map((item) => (item.id === estudio.id ? (payload.estudio as EstudioRecord) : item)));
      setStatus({ type: "success", message: "Estudio actualizado." });
    } catch (error) {
      showError(error, "No se pudo actualizar el estudio.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteEstudio(id: string) {
    setBusyAction(`delete-estudio-${id}`);
    setStatus(null);

    try {
      await submitJson(`/api/estudios/${id}`, "DELETE");
      setEstudios((current) => current.filter((item) => item.id !== id));
      setStatus({ type: "success", message: "Estudio eliminado." });
    } catch (error) {
      showError(error, "No se pudo eliminar el estudio.");
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
        onClick={() => { setActiveTab(id); setEditingSection(null); setEditingRecordId(null); }}
        className={`rounded-full px-5 py-2 text-sm font-semibold transition ${active
          ? "bg-[var(--primary)] text-white"
          : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)]/10"
          }`}
      >
        {label}
      </button>
    );
  }

  function startEditing(section: TabId, recordId?: string) {
    setActiveTab(section);
    setEditingSection(section);
    setEditingRecordId(recordId ?? null);
    setStatus(null);
  }

  function renderReadOnlySection() {
    if (activeTab === "datos") {
      const fields = [
        ["Nombre", `${patient.nombre} ${patient.apellido}`],
        ["DNI", patient.dni],
        ["Nacimiento", patient.fecha_nacimiento ?? "No informado"],
        ["Sexo", patient.sexo ?? "No informado"],
        ["Dirección", patient.direccion ?? "No informada"],
        ["Teléfono", patient.telefono ?? "No informado"],
        ["Email", patient.email ?? "No informado"],
        ["Obra social", patient.obra_social ?? "No informada"],
        ["N° de afiliado", patient.numero_afiliado ?? "No informado"],
        ["Contacto de emergencia", patient.contacto_emergencia_nombre ?? "No informado"],
        ["Teléfono de emergencia", patient.contacto_emergencia_telefono ?? "No informado"],
      ];
      return <section className="space-y-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-[var(--muted)]">Lectura</p><h3 className="mt-1 text-xl font-semibold text-[var(--primary)]">Datos personales</h3></div><button type="button" onClick={() => startEditing("datos")} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Editar datos</button></div><div className="grid gap-3 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p><p className="mt-1 text-sm text-[var(--foreground)]">{value}</p></div>)}</div></section>;
    }

    if (activeTab === "antecedentes") {
      return <section className="space-y-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-[var(--muted)]">Lectura</p><h3 className="mt-1 text-xl font-semibold text-[var(--primary)]">Antecedentes</h3></div><button type="button" onClick={() => startEditing("antecedentes")} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Agregar antecedente</button></div><div className="grid gap-4 md:grid-cols-2">{antecedenteOptions.map((option) => { const records = antecedentes.filter((item) => item.tipo === option.value); return <article key={option.value} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-[var(--primary)]">{option.label}</h4><span className="text-xs text-[var(--muted)]">{records.length} registro{records.length === 1 ? "" : "s"}</span></div>{records.length ? <div className="mt-3 space-y-3">{records.map((record) => <div key={record.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Título</p><p className="mt-1 font-semibold text-[var(--foreground)]">{record.titulo || "Sin título"}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Descripción</p><p className="mt-1 text-sm whitespace-pre-wrap">{record.descripcion || "Sin descripción"}</p><p className="mt-2 text-xs text-[var(--muted)]">Modificado: {new Date(record.updated_at).toLocaleString("es-AR")}</p><button type="button" onClick={() => startEditing("antecedentes", record.id)} className="mt-3 rounded-full border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)]">Editar</button></div>)}</div> : <p className="mt-3 text-sm text-[var(--muted)]">Sin información cargada.</p>}</article>; })}</div></section>;
    }

    if (activeTab === "consultas") { const uniqueConsultas = uniqueConsultations(consultas); const completedConsultas = uniqueCompletedConsultations(consultas); const filteredConsultas = consultaFilter === "todas" ? uniqueConsultas : uniqueConsultas.filter((consulta) => metadataText(consulta.metadata, "estado_turno") === consultaFilter); return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-[var(--muted)]">Historial</p><h3 className="mt-1 text-xl font-semibold text-[var(--primary)]">Consultas</h3></div><button type="button" onClick={() => startEditing("consultas")} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Agregar / modificar consulta</button></div>{filteredConsultas.length ? <div className="space-y-3">{filteredConsultas.map((consulta) => <article key={consulta.id} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><div className="grid gap-3 sm:grid-cols-2"><div><p className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--muted)]"><CalendarDays className="h-4 w-4" />Fecha</p><p className="mt-1 text-sm font-semibold">{displayDate(consulta.fecha)}</p></div><div><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Hora de agenda</p><p className="mt-1 text-sm font-semibold">{metadataText(consulta.metadata, "hora_agendada")}</p></div><div><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Modalidad</p><p className="mt-1 text-sm">{metadataText(consulta.metadata, "modalidad")}</p></div><div><p className="text-xs uppercase tracking-wider text-[var(--muted)]">Estado del turno</p><p className="mt-1 text-sm font-semibold">{metadataText(consulta.metadata, "estado_turno")}</p></div></div><div className="mt-4 border-t border-[var(--border)] pt-4 space-y-2 text-sm"><p><strong>Motivo:</strong> {consulta.motivo_consulta || "No informado"}</p><p className="flex items-start gap-2"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" /><span><strong>Observaciones:</strong> {consulta.observaciones || "No informadas"}</span></p><p className="text-xs text-[var(--muted)]"><strong>Turno de agenda:</strong> {metadataText(consulta.metadata, "turno_id")}</p></div><button type="button" onClick={() => startEditing("consultas", consulta.id)} className="mt-4 rounded-full border border-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary)]">Editar consulta</button></article>)}</div> : <p className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">No hay consultas en esta categoría.</p>}</section>; }

    const config: Record<Exclude<TabId, "datos" | "antecedentes" | "consultas">, { title: string; addLabel: string; items: Array<Record<string, unknown>>; fields: string[] }> = {
      diagnosticos: { title: "Diagnósticos", addLabel: "Agregar diagnóstico", items: diagnosticos, fields: ["descripcion", "codigo_cie10", "fecha"] },
      medicaciones: { title: "Medicaciones", addLabel: "Agregar medicación", items: medicaciones, fields: ["nombre_medicamento", "dosis", "frecuencia", "fecha_inicio", "fecha_fin", "activa"] },
      recetas: { title: "Recetas", addLabel: "Agregar receta", items: recetas, fields: ["fecha_emision", "pdf_url"] },
      estudios: { title: "Estudios", addLabel: "Agregar estudio", items: estudios, fields: ["titulo", "categoria", "fecha", "archivo_url"] },
    };
    const genericTab = activeTab as Exclude<TabId, "datos" | "antecedentes" | "consultas">;
    const section = config[genericTab];
    if (!section) return null;
    return <section className="space-y-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-[var(--muted)]">Lectura</p><h3 className="mt-1 text-xl font-semibold text-[var(--primary)]">{section.title}</h3></div><button type="button" onClick={() => startEditing(activeTab)} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">{section.addLabel}</button></div>{section.items.length ? <div className="space-y-3">{section.items.map((item, index) => <article key={String(item.id ?? index)} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4"><div className="grid gap-3 sm:grid-cols-2">{section.fields.map((field) => <div key={field}><p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{field.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-[var(--foreground)]">{field === "fecha_fin" && !item[field] ? "De por vida" : String(item[field] ?? "No informado")}</p></div>)}</div><button type="button" onClick={() => startEditing(activeTab, String(item.id))} className="mt-4 rounded-full border border-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary)]">Editar registro</button></article>)}</div> : <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-sm text-[var(--muted)]">No hay registros cargados. Usá “{section.addLabel}” para agregar uno.</div>}</section>;
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
      {activeTab === "consultas" && editingSection === null ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-2"><span className="px-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Filtrar estado</span><button type="button" onClick={() => setConsultaFilter("finalizado")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${consultaFilter === "finalizado" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>Finalizadas</button><button type="button" onClick={() => setConsultaFilter("rechazado")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${consultaFilter === "rechazado" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>Rechazadas</button><button type="button" onClick={() => setConsultaFilter("cancelado")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${consultaFilter === "cancelado" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>Canceladas</button><button type="button" onClick={() => setConsultaFilter("no_asistio")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${consultaFilter === "no_asistio" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>No asistió</button><button type="button" onClick={() => setConsultaFilter("todas")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${consultaFilter === "todas" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>Todas</button></div> : null}
      {editingSection !== null ? <button type="button" onClick={() => { setEditingSection(null); setEditingRecordId(null); }} className="mb-5 rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">Volver a lectura</button> : null}

      {editingSection === null ? renderReadOnlySection() : null}

      {activeTab === "datos" && editingSection === "datos" ? (
        <form onSubmit={handleSavePatient} className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Nombre</span>
              <input value={patientValues.nombre} onChange={(event) => setPatientValues((current) => ({ ...current, nombre: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Apellido</span>
              <input value={patientValues.apellido} onChange={(event) => setPatientValues((current) => ({ ...current, apellido: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">DNI</span>
              <input value={patientValues.dni} onChange={(event) => setPatientValues((current) => ({ ...current, dni: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
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
              <span className="text-sm font-semibold text-[var(--foreground)]">Direccion</span>
              <input value={patientValues.direccion} onChange={(event) => setPatientValues((current) => ({ ...current, direccion: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Telefono</span>
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
              <span className="text-sm font-semibold text-[var(--foreground)]">Numero de afiliado</span>
              <input value={patientValues.numero_afiliado} onChange={(event) => setPatientValues((current) => ({ ...current, numero_afiliado: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Contacto de emergencia</span>
              <input value={patientValues.contacto_emergencia_nombre} onChange={(event) => setPatientValues((current) => ({ ...current, contacto_emergencia_nombre: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">Telefono de emergencia</span>
              <input value={patientValues.contacto_emergencia_telefono} onChange={(event) => setPatientValues((current) => ({ ...current, contacto_emergencia_telefono: event.target.value }))} className="w-full rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-[var(--primary)]/20" />
            </label>
          </div>
          <button type="submit" disabled={busyAction === "save-patient"} className="w-fit rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-60">
            {busyAction === "save-patient" ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      ) : null}

      {activeTab === "antecedentes" && editingSection === "antecedentes" ? (
        <div className="space-y-6">
          {!editingRecordId ? <form onSubmit={handleCreateAntecedente} className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <select value={newAntecedente.tipo} onChange={(event) => setNewAntecedente((current) => ({ ...current, tipo: event.target.value as AntecedenteRecord["tipo"] }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                {antecedenteOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={newAntecedente.fecha_registro} onChange={(event) => setNewAntecedente((current) => ({ ...current, fecha_registro: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            </div>
            <input placeholder="Titulo (opcional)" value={newAntecedente.titulo} onChange={(event) => setNewAntecedente((current) => ({ ...current, titulo: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <textarea rows={3} placeholder="Descripcion" value={newAntecedente.descripcion} onChange={(event) => setNewAntecedente((current) => ({ ...current, descripcion: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <button type="submit" disabled={busyAction === "create-antecedente"} className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Agregar antecedente</button>
          </form> : <button type="button" onClick={() => setEditingRecordId(null)} className="w-fit rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Agregar otro antecedente</button>}

          {antecedentes.filter((item) => editingRecordId && item.id === editingRecordId).map((antecedente) => (
            <article key={antecedente.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={antecedente.tipo} onChange={(event) => setAntecedentes((current) => current.map((item) => item.id === antecedente.id ? { ...item, tipo: event.target.value as AntecedenteRecord["tipo"] } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                  {antecedenteOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input type="date" value={antecedente.fecha_registro} onChange={(event) => setAntecedentes((current) => current.map((item) => item.id === antecedente.id ? { ...item, fecha_registro: event.target.value } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              </div>
              <input value={toInput(antecedente.titulo)} onChange={(event) => setAntecedentes((current) => current.map((item) => item.id === antecedente.id ? { ...item, titulo: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <textarea rows={3} value={toInput(antecedente.descripcion)} onChange={(event) => setAntecedentes((current) => current.map((item) => item.id === antecedente.id ? { ...item, descripcion: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <div className="flex gap-3">
                <button type="button" onClick={() => handleUpdateAntecedente(antecedente)} disabled={busyAction === `update-antecedente-${antecedente.id}`} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                <button type="button" onClick={() => handleDeleteAntecedente(antecedente.id)} disabled={busyAction === `delete-antecedente-${antecedente.id}`} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "consultas" && editingSection === "consultas" ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateConsulta} className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--foreground)]/70">Fecha de consulta *</span>
                <input type="date" value={newConsulta.fecha} onChange={(event) => setNewConsulta((current) => ({ ...current, fecha: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" required />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--foreground)]/70">Profesional (opcional)</span>
                <input type="text" placeholder="Nombre o ID del profesional" value={newConsulta.profesional_id} onChange={(event) => setNewConsulta((current) => ({ ...current, profesional_id: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[var(--foreground)]/70">Motivo de consulta</span>
              <textarea rows={2} placeholder="Describe el motivo de la consulta..." value={newConsulta.motivo_consulta} onChange={(event) => setNewConsulta((current) => ({ ...current, motivo_consulta: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[var(--foreground)]/70">Observaciones</span>
              <textarea rows={2} placeholder="Notas adicionales..." value={newConsulta.observaciones} onChange={(event) => setNewConsulta((current) => ({ ...current, observaciones: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            </label>
            <button type="submit" disabled={busyAction === "create-consulta"} className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Agregar consulta</button>
          </form>

          {consultas.filter((item) => !editingRecordId || item.id === editingRecordId).map((consulta) => (
            <article key={consulta.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div className="text-sm font-semibold text-[var(--foreground)]">
                  {displayDate(consulta.fecha)}
                  {consulta.profesional_id && <span className="ml-3 text-xs text-[var(--foreground)]/60">Profesional: {consulta.profesional_id}</span>}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--foreground)]/70">Fecha</span>
                  <input type="date" value={consulta.fecha.slice(0, 10)} onChange={(event) => setConsultas((current) => current.map((item) => item.id === consulta.id ? { ...item, fecha: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-[var(--foreground)]/70">Profesional</span>
                  <input type="text" value={toInput(consulta.profesional_id)} onChange={(event) => setConsultas((current) => current.map((item) => item.id === consulta.id ? { ...item, profesional_id: event.target.value } : item))} placeholder="Nombre o ID del profesional" className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--foreground)]/70">Motivo de consulta</span>
                <textarea rows={2} value={toInput(consulta.motivo_consulta)} onChange={(event) => setConsultas((current) => current.map((item) => item.id === consulta.id ? { ...item, motivo_consulta: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[var(--foreground)]/70">Observaciones</span>
                <textarea rows={2} value={toInput(consulta.observaciones)} onChange={(event) => setConsultas((current) => current.map((item) => item.id === consulta.id ? { ...item, observaciones: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => handleUpdateConsulta(consulta)} disabled={busyAction === `update-consulta-${consulta.id}`} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                <button type="button" onClick={() => handleDeleteConsulta(consulta.id)} disabled={busyAction === `delete-consulta-${consulta.id}`} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "diagnosticos" && editingSection === "diagnosticos" ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateDiagnostico} className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
            <select value={newDiagnostico.consulta_id} onChange={(event) => setNewDiagnostico((current) => ({ ...current, consulta_id: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" required>
              <option value="">Seleccionar consulta</option>
              {consultaOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <input type="date" value={newDiagnostico.fecha} onChange={(event) => setNewDiagnostico((current) => ({ ...current, fecha: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <textarea rows={2} placeholder="Descripcion" value={newDiagnostico.descripcion} onChange={(event) => setNewDiagnostico((current) => ({ ...current, descripcion: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" required />
            <input placeholder="Codigo CIE10 (opcional)" value={newDiagnostico.codigo_cie10} onChange={(event) => setNewDiagnostico((current) => ({ ...current, codigo_cie10: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <button type="submit" disabled={busyAction === "create-diagnostico"} className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Agregar diagnostico</button>
          </form>

          {diagnosticos.filter((item) => !editingRecordId || item.id === editingRecordId).map((diagnostico) => (
            <article key={diagnostico.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <select value={diagnostico.consulta_id} onChange={(event) => setDiagnosticos((current) => current.map((item) => item.id === diagnostico.id ? { ...item, consulta_id: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                {consultaOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={diagnostico.fecha} onChange={(event) => setDiagnosticos((current) => current.map((item) => item.id === diagnostico.id ? { ...item, fecha: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <textarea rows={2} value={diagnostico.descripcion} onChange={(event) => setDiagnosticos((current) => current.map((item) => item.id === diagnostico.id ? { ...item, descripcion: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <input value={toInput(diagnostico.codigo_cie10)} onChange={(event) => setDiagnosticos((current) => current.map((item) => item.id === diagnostico.id ? { ...item, codigo_cie10: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <div className="flex gap-3">
                <button type="button" onClick={() => handleUpdateDiagnostico(diagnostico)} disabled={busyAction === `update-diagnostico-${diagnostico.id}`} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                <button type="button" onClick={() => handleDeleteDiagnostico(diagnostico.id)} disabled={busyAction === `delete-diagnostico-${diagnostico.id}`} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "medicaciones" && editingSection === "medicaciones" ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateMedicacion} className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
            <select value={newMedicacion.consulta_id} onChange={(event) => setNewMedicacion((current) => ({ ...current, consulta_id: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
              <option value="">Sin consulta asociada</option>
              {consultaOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <input required placeholder="Nombre del medicamento" value={newMedicacion.nombre_medicamento} onChange={(event) => setNewMedicacion((current) => ({ ...current, nombre_medicamento: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input placeholder="Dosis" value={newMedicacion.dosis} onChange={(event) => setNewMedicacion((current) => ({ ...current, dosis: event.target.value }))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <input placeholder="Frecuencia" value={newMedicacion.frecuencia} onChange={(event) => setNewMedicacion((current) => ({ ...current, frecuencia: event.target.value }))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input type="date" value={newMedicacion.fecha_inicio} onChange={(event) => setNewMedicacion((current) => ({ ...current, fecha_inicio: event.target.value }))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <input type="date" value={newMedicacion.fecha_fin} onChange={(event) => setNewMedicacion((current) => ({ ...current, fecha_fin: event.target.value }))} disabled={newMedicacion.cronica} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm disabled:opacity-50" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
              <input type="checkbox" checked={newMedicacion.cronica} onChange={(event) => setNewMedicacion((current) => ({ ...current, cronica: event.target.checked, fecha_fin: event.target.checked ? "" : current.fecha_fin }))} />
              Tratamiento crónico
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
              <input type="checkbox" checked={newMedicacion.activa} onChange={(event) => setNewMedicacion((current) => ({ ...current, activa: event.target.checked }))} />
              Activa
            </label>
            <button type="submit" disabled={busyAction === "create-medicacion"} className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Agregar medicacion</button>
          </form>

          {medicaciones.filter((item) => !editingRecordId || item.id === editingRecordId).map((medicacion) => (
            <article key={medicacion.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <select value={toInput(medicacion.consulta_id)} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, consulta_id: event.target.value || null } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                <option value="">Sin consulta asociada</option>
                {consultaOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <input value={medicacion.nombre_medicamento} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, nombre_medicamento: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={toInput(medicacion.dosis)} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, dosis: event.target.value } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
                <input value={toInput(medicacion.frecuencia)} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, frecuencia: event.target.value } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={toInput(medicacion.fecha_inicio)} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, fecha_inicio: event.target.value } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
                <input type="date" value={toInput(medicacion.fecha_fin)} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, fecha_fin: event.target.value } : item))} disabled={medicacion.cronica} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm disabled:opacity-50" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                <input type="checkbox" checked={medicacion.cronica} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, cronica: event.target.checked, fecha_fin: event.target.checked ? null : (item.fecha_fin ?? todayIso()) } : item))} />
                Tratamiento crónico
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                <input type="checkbox" checked={medicacion.activa} onChange={(event) => setMedicaciones((current) => current.map((item) => item.id === medicacion.id ? { ...item, activa: event.target.checked } : item))} />
                Activa
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => handleUpdateMedicacion(medicacion)} disabled={busyAction === `update-medicacion-${medicacion.id}`} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                <button type="button" onClick={() => handleDeleteMedicacion(medicacion.id)} disabled={busyAction === `delete-medicacion-${medicacion.id}`} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "recetas" && editingSection === "recetas" ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateReceta} className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
            <select value={newReceta.consulta_id} onChange={(event) => setNewReceta((current) => ({ ...current, consulta_id: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
              <option value="">Sin consulta asociada</option>
              {consultaOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <input type="date" value={newReceta.fecha_emision} onChange={(event) => setNewReceta((current) => ({ ...current, fecha_emision: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <label className="space-y-1"><span className="text-sm font-semibold text-[var(--foreground)]">Entregar receta electrónica / devolución</span><input type="url" placeholder="https://..." value={newReceta.pdf_url} onChange={(event) => setNewReceta((current) => ({ ...current, pdf_url: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" /><span className="text-xs text-[var(--muted)]">Pegá el enlace al PDF o documento que podrá abrir el paciente.</span></label>
            <button type="submit" disabled={busyAction === "create-receta"} className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Guardar y entregar receta</button>
          </form>

          {recetas.filter((item) => !editingRecordId || item.id === editingRecordId).map((receta) => (
            <article key={receta.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <select value={toInput(receta.consulta_id)} onChange={(event) => setRecetas((current) => current.map((item) => item.id === receta.id ? { ...item, consulta_id: event.target.value || null } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                <option value="">Sin consulta asociada</option>
                {consultaOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <input type="date" value={receta.fecha_emision} onChange={(event) => setRecetas((current) => current.map((item) => item.id === receta.id ? { ...item, fecha_emision: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <label className="space-y-1"><span className="text-sm font-semibold text-[var(--foreground)]">Enlace de receta electrónica / devolución</span><input type="url" value={toInput(receta.pdf_url)} onChange={(event) => setRecetas((current) => current.map((item) => item.id === receta.id ? { ...item, pdf_url: event.target.value } : item))} placeholder="https://..." className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" /></label>
              <div className="flex gap-3">
                <button type="button" onClick={() => handleUpdateReceta(receta, recetaMedicacionesDrafts[receta.id] ?? "")} disabled={busyAction === `update-receta-${receta.id}`} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                <button type="button" onClick={() => handleDeleteReceta(receta.id)} disabled={busyAction === `delete-receta-${receta.id}`} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === "estudios" && editingSection === "estudios" ? (
        <div className="space-y-6">
          <form onSubmit={handleCreateEstudio} className="grid gap-4 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
            <select value={newEstudio.consulta_id} onChange={(event) => setNewEstudio((current) => ({ ...current, consulta_id: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
              <option value="">Sin consulta asociada</option>
              {consultaOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <input placeholder="Titulo" value={newEstudio.titulo} onChange={(event) => setNewEstudio((current) => ({ ...current, titulo: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" required />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={newEstudio.categoria} onChange={(event) => setNewEstudio((current) => ({ ...current, categoria: event.target.value }))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                {estudioCategoriaOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <input type="date" value={newEstudio.fecha} onChange={(event) => setNewEstudio((current) => ({ ...current, fecha: event.target.value }))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            </div>
            <input placeholder="URL de archivo (Supabase Storage)" value={newEstudio.archivo_url} onChange={(event) => setNewEstudio((current) => ({ ...current, archivo_url: event.target.value }))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
            <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
              <input type="checkbox" checked={newEstudio.es_descargable} onChange={(event) => setNewEstudio((current) => ({ ...current, es_descargable: event.target.checked }))} />
              Es descargable
            </label>
            <button type="submit" disabled={busyAction === "create-estudio"} className="w-fit rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Agregar estudio</button>
          </form>

          {estudios.filter((item) => !editingRecordId || item.id === editingRecordId).map((estudio) => (
            <article key={estudio.id} className="space-y-3 rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-5">
              <select value={toInput(estudio.consulta_id)} onChange={(event) => setEstudios((current) => current.map((item) => item.id === estudio.id ? { ...item, consulta_id: event.target.value || null } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                <option value="">Sin consulta asociada</option>
                {consultaOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <input value={estudio.titulo} onChange={(event) => setEstudios((current) => current.map((item) => item.id === estudio.id ? { ...item, titulo: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={estudio.categoria} onChange={(event) => setEstudios((current) => current.map((item) => item.id === estudio.id ? { ...item, categoria: event.target.value } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm">
                  {estudioCategoriaOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <input type="date" value={estudio.fecha} onChange={(event) => setEstudios((current) => current.map((item) => item.id === estudio.id ? { ...item, fecha: event.target.value } : item))} className="rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              </div>
              <input value={toInput(estudio.archivo_url)} onChange={(event) => setEstudios((current) => current.map((item) => item.id === estudio.id ? { ...item, archivo_url: event.target.value } : item))} className="w-full rounded-[1rem] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" />
              <label className="inline-flex items-center gap-2 text-sm text-[var(--foreground)]/80">
                <input type="checkbox" checked={estudio.es_descargable} onChange={(event) => setEstudios((current) => current.map((item) => item.id === estudio.id ? { ...item, es_descargable: event.target.checked } : item))} />
                Es descargable
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => handleUpdateEstudio(estudio)} disabled={busyAction === `update-estudio-${estudio.id}`} className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                <button type="button" onClick={() => handleDeleteEstudio(estudio.id)} disabled={busyAction === `delete-estudio-${estudio.id}`} className="rounded-full border border-rose-300 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
