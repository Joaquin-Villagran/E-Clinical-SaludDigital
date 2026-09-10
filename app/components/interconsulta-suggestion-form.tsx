"use client";

import { useState } from "react";

export type ReferralDoctor = { id: string; nombre: string | null; especialidad: string | null; matricula: string | null; foto_url: string | null };

export default function InterconsultaSuggestionForm({ appointmentId, doctors }: { appointmentId: string; doctors: ReferralDoctor[] }) {
  const [specialty, setSpecialty] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!specialty.trim()) { setStatus("Indicá la especialidad sugerida."); return; }
    setSaving(true); setStatus("");
    try {
      const response = await fetch(`/api/teleconsulta/${appointmentId}/closure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest_interconsulta", especialidad_destino: specialty, profesional_destino_id: doctorId || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la interconsulta.");
      setStatus("Interconsulta guardada. El paciente la verá al cerrar la consulta.");
      setSpecialty(""); setDoctorId("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "No se pudo guardar la interconsulta."); }
    finally { setSaving(false); }
  }

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-5"><p className="text-sm font-semibold text-[var(--primary)]">Interconsulta sugerida</p><p className="mt-1 text-sm text-[var(--muted)]">Indicala solo si el paciente necesita continuar con otra especialidad.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Especialidad de destino" className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm" /><select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"><option value="">Profesional específico (opcional)</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.nombre || "Profesional"}{doctor.especialidad ? ` · ${doctor.especialidad}` : ""}</option>)}</select></div><button type="button" onClick={() => void submit()} disabled={saving} className="mt-4 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar sugerencia"}</button>{status ? <p className="mt-3 text-sm text-[var(--primary)]">{status}</p> : null}</section>;
}
