"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import PatientEHRForm from "@/app/panel/pacientes/[id]/patient-ehr-form";
import type { Database } from "@/lib/database.types";

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

type FichaBundle = {
  paciente: PatientRow;
  antecedentes: AntecedenteRow[];
  consultas: ConsultaRow[];
  diagnosticos: DiagnosticoRow[];
  medicaciones: MedicacionRow[];
  recetas: RecetaRow[];
  estudios: EstudioRow[];
};

type NewPatientForm = {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  obra_social: string;
};

type Props = {
  turnoId: string;
  pacienteId: string | null;
  prefill: { nombreCompleto: string; telefono: string; email: string; obraSocial: string | null };
  initialActiveTab?: "datos" | "antecedentes" | "consultas" | "diagnosticos" | "medicaciones" | "recetas" | "estudios";
};

function splitName(fullName: string) {
  const [first = "", ...rest] = fullName.trim().split(/\s+/);
  return { nombre: first, apellido: rest.join(" ") };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}

function renderRows(items: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>) {
  if (!items.length) return "<p>Sin registros.</p>";
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const rows = items
    .map((item) => `<tr>${columns.map((column) => `<td>${escapeHtml(String(item[column.key] ?? "-"))}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

// Abre el diálogo de impresión del navegador: el médico elige "Guardar como PDF" sin depender de librerías externas.
function printFicha(bundle: FichaBundle) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) return;

  const paciente = bundle.paciente;
  const sections = `
    <h2>Datos personales</h2>
    <table><tbody>
      <tr><th>Nombre</th><td>${escapeHtml(`${paciente.nombre} ${paciente.apellido}`)}</td></tr>
      <tr><th>DNI</th><td>${escapeHtml(paciente.dni)}</td></tr>
      <tr><th>Fecha de nacimiento</th><td>${escapeHtml(paciente.fecha_nacimiento ?? "No informada")}</td></tr>
      <tr><th>Sexo</th><td>${escapeHtml(paciente.sexo ?? "No informado")}</td></tr>
      <tr><th>Teléfono</th><td>${escapeHtml(paciente.telefono ?? "No informado")}</td></tr>
      <tr><th>Email</th><td>${escapeHtml(paciente.email ?? "No informado")}</td></tr>
      <tr><th>Obra social</th><td>${escapeHtml(paciente.obra_social ?? "No informada")}</td></tr>
    </tbody></table>

    <h2>Antecedentes</h2>
    ${renderRows(bundle.antecedentes, [
      { key: "tipo", label: "Tipo" },
      { key: "titulo", label: "Título" },
      { key: "descripcion", label: "Descripción" },
      { key: "fecha_registro", label: "Fecha" },
    ])}

    <h2>Consultas</h2>
    ${renderRows(bundle.consultas, [
      { key: "fecha", label: "Fecha" },
      { key: "motivo_consulta", label: "Motivo" },
      { key: "examen_fisico", label: "Examen físico" },
      { key: "observaciones", label: "Observaciones" },
    ])}

    <h2>Diagnósticos</h2>
    ${renderRows(bundle.diagnosticos, [
      { key: "descripcion", label: "Descripción" },
      { key: "codigo_cie10", label: "CIE-10" },
      { key: "fecha", label: "Fecha" },
    ])}

    <h2>Medicaciones</h2>
    ${renderRows(bundle.medicaciones, [
      { key: "nombre_medicamento", label: "Medicamento" },
      { key: "dosis", label: "Dosis" },
      { key: "frecuencia", label: "Frecuencia" },
      { key: "activa", label: "Activa" },
    ])}

    <h2>Recetas</h2>
    ${renderRows(bundle.recetas, [
      { key: "fecha_emision", label: "Fecha de emisión" },
      { key: "pdf_url", label: "PDF" },
    ])}

    <h2>Estudios</h2>
    ${renderRows(bundle.estudios, [
      { key: "titulo", label: "Título" },
      { key: "categoria", label: "Categoría" },
      { key: "fecha", label: "Fecha" },
    ])}
  `;

  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8" />
    <title>Ficha clínica - ${escapeHtml(`${paciente.nombre} ${paciente.apellido}`)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #1f2b2b; padding: 24px; }
      h1 { margin-bottom: 4px; }
      h2 { margin-top: 28px; border-bottom: 1px solid #e2ded4; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #e2ded4; padding: 6px 8px; text-align: left; font-size: 13px; vertical-align: top; }
      th { background: #f6f4ef; }
    </style>
  </head><body>
    <h1>Ficha clínica</h1>
    <p>Generada el ${escapeHtml(new Date().toLocaleString("es-AR"))}</p>
    ${sections}
  </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// Reutilizado por la agenda del médico y por la lista de teleconsultas para no duplicar la carga/edición de la ficha.
export default function FichaClinicaPanel({ turnoId, pacienteId: initialPacienteId, prefill, initialActiveTab }: Props) {
  const router = useRouter();
  const [pacienteId, setPacienteId] = useState(initialPacienteId);
  const [bundle, setBundle] = useState<FichaBundle | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(pacienteId !== null);
  const [fichaError, setFichaError] = useState("");

  const [newPatient, setNewPatient] = useState<NewPatientForm>(() => ({
    ...splitName(prefill.nombreCompleto),
    dni: "",
    telefono: prefill.telefono,
    email: prefill.email,
    obra_social: prefill.obraSocial ?? "",
  }));
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [linkNotice, setLinkNotice] = useState("");

  const newPatientValid = newPatient.nombre.trim() && newPatient.apellido.trim() && newPatient.dni.trim();

  useEffect(() => {
    if (initialPacienteId) void loadFicha(initialPacienteId);
    // Sólo se carga con el paciente que llegó al montar; las creaciones posteriores llaman loadFicha directamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFicha(id: string) {
    setLoadingFicha(true);
    setFichaError("");
    try {
      const response = await fetch(`/api/pacientes/${id}/ficha`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar la ficha clínica.");
      setBundle(payload as FichaBundle);
    } catch (error) {
      setFichaError(error instanceof Error ? error.message : "No se pudo cargar la ficha clínica.");
    } finally {
      setLoadingFicha(false);
    }
  }

  async function createPatient() {
    setCreatingPatient(true);
    setCreateMessage("");
    try {
      const response = await fetch("/api/pacientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newPatient, turno_id: turnoId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo crear la historia clínica.");
      if (payload.existing) setLinkNotice("Ya existía una ficha con ese DNI o email: se vinculó al turno.");
      setPacienteId(payload.paciente.id);
      await loadFicha(payload.paciente.id);
      router.refresh();
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : "No se pudo crear la historia clínica.");
    } finally {
      setCreatingPatient(false);
    }
  }

  if (!pacienteId) {
    return (
      <div>
        <p className="text-sm font-semibold text-[var(--primary)]">El paciente aún no tiene ficha clínica vinculada</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Nombre
            <input
              value={newPatient.nombre}
              onChange={(event) => setNewPatient((current) => ({ ...current, nombre: event.target.value }))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Apellido
            <input
              value={newPatient.apellido}
              onChange={(event) => setNewPatient((current) => ({ ...current, apellido: event.target.value }))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            DNI
            <input
              value={newPatient.dni}
              onChange={(event) => setNewPatient((current) => ({ ...current, dni: event.target.value }))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Teléfono
            <input
              value={newPatient.telefono}
              onChange={(event) => setNewPatient((current) => ({ ...current, telefono: event.target.value }))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Email
            <input
              value={newPatient.email}
              onChange={(event) => setNewPatient((current) => ({ ...current, email: event.target.value }))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Obra social
            <input
              value={newPatient.obra_social}
              onChange={(event) => setNewPatient((current) => ({ ...current, obra_social: event.target.value }))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={createPatient}
              disabled={creatingPatient || !newPatientValid}
              className="w-fit rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creatingPatient ? "Creando..." : "Crear historia clínica"}
            </button>
            {createMessage ? <p className="mt-2 text-sm text-red-700">{createMessage}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (loadingFicha) return <p className="text-sm text-[var(--muted)]">Cargando ficha clínica...</p>;
  if (fichaError) return <p className="text-sm text-red-700">{fichaError}</p>;
  if (!bundle) return null;

  return (
    <div>
      {linkNotice ? <p className="mb-4 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--primary)]">{linkNotice}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--primary)]">Ficha clínica completa</p>
        <button
          type="button"
          onClick={() => printFicha(bundle)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]"
        >
          <Download className="h-4 w-4" />
          Descargar PDF
        </button>
      </div>
      <div className="mt-4">
        <PatientEHRForm
          patient={bundle.paciente}
          antecedentes={bundle.antecedentes}
          consultas={bundle.consultas}
          diagnosticos={bundle.diagnosticos}
          medicaciones={bundle.medicaciones}
          recetas={bundle.recetas}
          estudios={bundle.estudios}
          initialActiveTab={initialActiveTab}
        />
      </div>
    </div>
  );
}
