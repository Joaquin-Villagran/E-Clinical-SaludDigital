"use client";

import { FormEvent, useEffect, useState } from "react";

type UploadStatus = "idle" | "loading" | "success" | "error";

type TurnoForUpload = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  motivo: string;
  fecha_preferida: string;
  hora_preferida: string;
  estado: string;
  obra_social?: string | null;
  metadata?: { especialidad?: string } | null;
};

type InitialValues = {
  pacienteEmail?: string;
  titulo?: string;
  categoria?: string;
  fecha?: string;
  hora?: string;
  turnoId?: string;
};

type Props = {
  initialValues?: InitialValues;
  turnos?: TurnoForUpload[];
};

function formatDateTime(fecha?: string | null, hora?: string | null) {
  if (!fecha) return "Fecha no disponible";

  const dateParts = fecha.split("-").map(Number);
  const timeParts = hora?.split(":").map(Number) ?? [0, 0];
  if (dateParts.length < 3 || dateParts.some(Number.isNaN)) {
    return `${fecha} ${hora ?? ""}`;
  }

  const [year, month, day] = dateParts;
  const [hour = 0, minute = 0] = timeParts;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const weekdays = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const weekday = weekdays[date.getUTCDay()];
  const monthLabel = months[date.getUTCMonth()];
  const dayNumber = String(date.getUTCDate()).padStart(2, "0");

  if (!hora) {
    return `${weekday}, ${dayNumber} ${monthLabel}`;
  }

  const hours24 = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const isPm = hours24 >= 12;
  const hours12 = hours24 % 12 || 12;
  const ampm = isPm ? "p. m." : "a. m.";

  return `${weekday}, ${dayNumber} ${monthLabel}, ${hours12}:${minutes} ${ampm}`;
}

export default function DoctorStudyUploadForm({ initialValues, turnos }: Props) {
  const [pacienteEmail, setPacienteEmail] = useState(initialValues?.pacienteEmail ?? "");
  const [titulo, setTitulo] = useState(initialValues?.titulo ?? "");
  const [categoria, setCategoria] = useState(initialValues?.categoria ?? "");
  const [fecha, setFecha] = useState(initialValues?.fecha ?? "");
  const [hora, setHora] = useState(initialValues?.hora ?? "");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [turnoId, setTurnoId] = useState(initialValues?.turnoId ?? "");
  const [selectedTurno, setSelectedTurno] = useState<TurnoForUpload | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!initialValues) return;
    setPacienteEmail(initialValues.pacienteEmail ?? "");
    setTitulo(initialValues.titulo ?? "");
    setCategoria(initialValues.categoria ?? "");
    setFecha(initialValues.fecha ?? "");
    setHora(initialValues.hora ?? "");
    setTurnoId(initialValues.turnoId ?? "");
  }, [initialValues]);

  useEffect(() => {
    if (!selectedTurno) return;
    setPacienteEmail(selectedTurno.email);
    setTitulo(`Resultado de ${selectedTurno.nombre}`);
    setCategoria(selectedTurno.metadata?.especialidad ?? "Estudio médico");
    setFecha(selectedTurno.fecha_preferida);
    setHora(selectedTurno.hora_preferida);
    setTurnoId(selectedTurno.id);
    setStatus("idle");
    setMessage("");
  }, [selectedTurno]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!pacienteEmail.trim() || !titulo.trim() || !categoria.trim() || !fecha || !hora) {
      setStatus("error");
      setMessage("Completa paciente, título, categoría, fecha y hora.");
      return;
    }

    if (!externalUrl.trim() && !file) {
      setStatus("error");
      setMessage("Carga un archivo o ingresa un enlace para el resultado.");
      return;
    }

    if (file && file.size < 10 * 1024 * 1024) {
      setStatus("error");
      setMessage("El archivo debe tener al menos 10 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("paciente_email", pacienteEmail.trim());
    formData.append("titulo", titulo.trim());
    formData.append("categoria", categoria.trim());
    formData.append("fecha", fecha);
    formData.append("hora", hora);
    if (turnoId) {
      formData.append("turno_id", turnoId);
    }
    if (externalUrl.trim()) {
      formData.append("external_url", externalUrl.trim());
    }
    if (file) {
      formData.append("file", file);
    }

    try {
      const response = await fetch("/api/estudios", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        setStatus("error");
        setMessage(errorData?.error || "No se pudo guardar el resultado. Intenta nuevamente.");
        return;
      }

      setStatus("success");
      setMessage("Resultado cargado correctamente.");
      setPacienteEmail("");
      setTitulo("");
      setCategoria("");
      setFecha("");
      setHora("");
      setExternalUrl("");
      setFile(null);
      setTurnoId("");
      setSelectedTurno(null);
    } catch (error) {
      setStatus("error");
      setMessage("Ocurrió un error al cargar el resultado. Intenta nuevamente.");
    }
  }

  return (
    <div className="space-y-6">
      {turnos && turnos.length > 0 ? (
        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Turnos listos</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">Seleccioná un turno para adjuntar resultados</h2>
            <p className="mt-2 text-sm text-[var(--foreground)]/75">Todos los turnos confirmados con fecha de hoy o anterior.</p>
          </div>
          <div className="space-y-4">
            {turnos.map((turno) => (
              <article key={turno.id} className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--background)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{turno.nombre}</p>
                    <p className="mt-1 text-sm text-[var(--foreground)]/80">{turno.email} · {turno.telefono}</p>
                    <p className="mt-2 text-sm text-[var(--foreground)]/75">{turno.motivo}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                      {turno.estado}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTurno(turno)}
                      className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)]/10"
                    >
                      Usar este turno
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--foreground)]/75">
                  <span>{formatDateTime(turno.fecha_preferida, turno.hora_preferida)}</span>
                  <span>•</span>
                  <span>{turno.obra_social ?? "Particular / no informado"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {selectedTurno ? (
        <section className="rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Turno seleccionado</p>
          <p className="mt-3 text-sm text-[var(--foreground)]/80">
            {selectedTurno.nombre} — {selectedTurno.email} · {formatDateTime(selectedTurno.fecha_preferida, selectedTurno.hora_preferida)}
          </p>
          <p className="mt-2 text-sm text-[var(--foreground)]/75">Motivo: {selectedTurno.motivo}</p>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span>Paciente (email)</span>
            <input
              type="email"
              value={pacienteEmail}
              onChange={(event) => setPacienteEmail(event.target.value)}
              required
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
            />
          </label>
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span>Título del resultado</span>
            <input
              type="text"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span>Categoría</span>
            <input
              type="text"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              required
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
            />
          </label>
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span>Fecha de estudio</span>
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              required
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span>Hora de estudio</span>
            <input
              type="time"
              value={hora}
              onChange={(event) => setHora(event.target.value)}
              required
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
            />
          </label>
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span>Subir archivo (mayor o igual a 10 MB)</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--primary)]/80"
            />
          </label>
        </div>

        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>O ingresa un enlace externo</span>
          <input
            type="url"
            value={externalUrl}
            onChange={(event) => setExternalUrl(event.target.value)}
            placeholder="https://"
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>

        {message ? (
          <div className={`rounded-3xl border px-4 py-3 text-sm ${status === "success" ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"}`}>
            {message}
          </div>
        ) : null}

        <button type="submit" disabled={status === "loading"} className="w-full rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-60">
          {status === "loading" ? "Subiendo..." : "Cargar resultado"}
        </button>
      </form>
    </div>
  );
}
