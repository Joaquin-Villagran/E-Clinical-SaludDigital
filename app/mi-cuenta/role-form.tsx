"use client";

import { useState } from "react";

export default function RoleForm({ currentRole }: { currentRole?: string | null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [role, setRole] = useState(currentRole ?? "patient");

  async function promote() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "doctor" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Error al actualizar rol.");
        setLoading(false);
        return;
      }

      // Ensure doctors row exists
      await fetch("/api/users/create-doctor", { method: "POST" });

      setMessage("Felicidades — ahora sos profesional. Redirigiendo al panel...");
      setRole("doctor");
      setTimeout(() => (window.location.href = "/panel"), 1200);
    } catch (err: any) {
      setMessage(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function demote() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/set-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "patient" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Error al actualizar rol.");
        setLoading(false);
        return;
      }
      setRole("patient");
      setMessage("Rol cambiado a paciente.");
    } catch (err: any) {
      setMessage(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-6">
      <p className="text-sm text-[var(--foreground)]/75">Rol actual</p>
      <p className="text-lg font-semibold text-[var(--primary)]">{role}</p>
      {message ? <p className="text-sm text-[var(--foreground)]/80">{message}</p> : null}
      <div className="flex gap-3">
        {role !== "doctor" ? (
          <button onClick={promote} disabled={loading} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Promover a profesional
          </button>
        ) : (
          <button onClick={demote} disabled={loading} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60">
            Revertir a paciente
          </button>
        )}
      </div>
    </div>
  );
}
