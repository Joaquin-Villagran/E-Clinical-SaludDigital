"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const dayNumber = String(date.getUTCDate()).padStart(1, "0");

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

function getWhatsappLink(telefono: string) {
  const digits = telefono.replace(/\D+/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

type Turno = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  motivo: string;
  fecha_preferida: string;
  hora_preferida: string;
  estado: string;
  obra_social?: string | null;
  metadata?: { especialidad?: string; [key: string]: any } | null;
};

type Props = {
  turno: Turno;
};

export default function TurnoRequestCard({ turno }: Props) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(turno.estado);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "confirmar" | "cancelar") {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/turnos/${turno.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "No se pudo procesar la acción.");
      } else {
        if (action === "confirmar") {
          setCurrentStatus("confirmado");
          setMessage("Turno confirmado. Se envió la confirmación por email y WhatsApp cuando esté disponible.");
          router.refresh();
        } else if (action === "cancelar") {
          setCurrentStatus("cancelado");
          setMessage("Turno eliminado exitosamente.");
          router.refresh();
        }
      }
    } catch (error) {
      setMessage("Ocurrió un error. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--primary)]">{turno.nombre}</h3>
          <p className="mt-1 text-sm text-[var(--foreground)]/80">{turno.email} · {turno.telefono}</p>
        </div>
        <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          {currentStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]/85">
          <p className="font-semibold text-[var(--foreground)]">Fecha y hora</p>
          <p>{formatDateTime(turno.fecha_preferida, turno.hora_preferida)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground)]/85">
          <p className="font-semibold text-[var(--foreground)]">Especialidad</p>
          <p>{turno.metadata?.especialidad ?? "No especificada"}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--foreground)]/85">Motivo: {turno.motivo}</p>
      <p className="mt-2 text-sm text-[var(--foreground)]/75">Obra social: {turno.obra_social ?? "Particular / no informado"}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        {currentStatus !== "confirmado" && currentStatus !== "cancelado" ? (
          <button
            type="button"
            onClick={() => handleAction("confirmar")}
            disabled={loading}
            className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:opacity-60"
          >
            Confirmar
          </button>
        ) : null}
        {currentStatus !== "cancelado" ? (
          <button
            type="button"
            onClick={() => handleAction("cancelar")}
            disabled={loading}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            Eliminar
          </button>
        ) : null}
        {getWhatsappLink(turno.telefono) ? (
          <a
            href={getWhatsappLink(turno.telefono)!}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            WhatsApp
          </a>
        ) : null}
      </div>

      {message ? (
        <p className="mt-4 rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4 text-sm text-[var(--accent)]">
          {message}
        </p>
      ) : null}
    </article>
  );
}
