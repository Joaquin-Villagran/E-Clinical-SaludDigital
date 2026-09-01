"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Clock, Mail, MessageSquare, Phone, Search, User } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

type Status = "idle" | "loading" | "success" | "error";

type TurnoData = {
  nombre: string;
  email: string;
  telefono: string;
  motivo: string;
  fecha_preferida: string;
  hora_preferida: string;
  obra_social: string;
  es_particular: boolean;
  especialidad: string;
};

const initialData: TurnoData = {
  nombre: "",
  email: "",
  telefono: "",
  motivo: "",
  fecha_preferida: "",
  hora_preferida: "",
  obra_social: "",
  es_particular: false,
  especialidad: "",
};

export default function TurnoForm() {
  const [data, setData] = useState<TurnoData>(initialData);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    const updateSessionData = (session: any) => {
      if (!session?.user) {
        setIsLoggedIn(false);
        return;
      }

      const user = session.user;
      const metadata = user.user_metadata ?? {};
      const fullName = metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || "";

      setData((current) => ({
        ...current,
        nombre: fullName || user.email || current.nombre,
        email: user.email || current.email,
        telefono: metadata.telefono || metadata.phone || current.telefono,
        obra_social: metadata.obra_social || current.obra_social,
      }));
      setIsLoggedIn(true);
    };

    async function loadSession() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!mounted) return;
      updateSessionData(sessionData.session);
      setSessionLoaded(true);
    }

    loadSession();

    const { data: listener } = supabase.auth.onAuthStateChange((
      _event: string,
      session: { session: any } | null
    ) => {
      if (!mounted) return;
      updateSessionData(session?.session ?? null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleChange = (field: keyof TurnoData, value: string) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const handleToggleParticular = (checked: boolean) => {
    setData((current) => ({ ...current, es_particular: checked, obra_social: checked ? "" : current.obra_social }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    if (!data.especialidad.trim() || !data.motivo.trim() || !data.fecha_preferida || !data.hora_preferida) {
      setStatus("error");
      setMessage("Completa motivo, médico/especialidad, fecha y hora para solicitar el turno.");
      return;
    }

    if (!data.nombre || !data.email || !data.telefono) {
      setStatus("error");
      setMessage("Faltan datos de cuenta. Inicia sesión o completa tus datos de contacto.");
      return;
    }

    try {
      const payload = { ...data, es_particular: Boolean(data.es_particular) };

      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(err?.error || "No se pudo enviar la solicitud de turno. Intenta otra vez más tarde.");
        return;
      }

      setStatus("success");
      setMessage("Turno solicitado correctamente. Te contactaremos pronto para confirmar.");
      setData((current) => ({
        ...current,
        motivo: "",
        fecha_preferida: "",
        hora_preferida: "",
        especialidad: "",
        es_particular: false,
      }));
    } catch (e) {
      setStatus("error");
      setMessage("No se pudo enviar la solicitud de turno. Intenta otra vez más tarde.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_24px_80px_rgba(14,75,78,0.08)]">
      {sessionLoaded && isLoggedIn ? (
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-5 text-sm text-[var(--foreground)]/80">
          <p className="font-medium text-[var(--foreground)]">Tus datos ya están cargados desde tu cuenta.</p>
          {data.obra_social ? (
            <p>Obra social registrada: <strong>{data.obra_social}</strong></p>
          ) : (
            <p>No hay obra social registrada en tu cuenta. Si querés, podés solicitar la consulta como particular.</p>
          )}
        </div>
      ) : null}

      {!isLoggedIn ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
              <User className="h-4 w-4" /> Nombre completo
            </span>
            <input value={data.nombre} onChange={(event) => handleChange("nombre", event.target.value)} required className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
          </label>
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
              <Mail className="h-4 w-4" /> Email
            </span>
            <input type="email" value={data.email} onChange={(event) => handleChange("email", event.target.value)} required className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
          </label>
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
              <Phone className="h-4 w-4" /> Teléfono
            </span>
            <input type="tel" value={data.telefono} onChange={(event) => handleChange("telefono", event.target.value)} required className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
          </label>
          <label className="space-y-2 text-sm text-[var(--foreground)]/80">
            <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">Obra social / Prepaga</span>
            <input type="text" value={data.obra_social} onChange={(event) => handleChange("obra_social", event.target.value)} placeholder="Ej: Nombre de la Obra Social" disabled={data.es_particular} className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
          </label>
          <label className="flex items-center gap-3 text-sm text-[var(--foreground)]/80">
            <input type="checkbox" checked={data.es_particular} onChange={(e) => handleToggleParticular(e.target.checked)} className="w-4 h-4" />
            <span className="font-medium">Consulta particular (sin obra social)</span>
          </label>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm text-[var(--foreground)]/80">
            <input type="checkbox" checked={data.es_particular} onChange={(e) => handleToggleParticular(e.target.checked)} className="w-4 h-4" />
            <span className="font-medium">Consulta particular (sin obra social)</span>
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
            <Search className="h-4 w-4" /> Buscar médico o especialidad
          </span>
          <input
            type="text"
            value={data.especialidad}
            onChange={(event) => handleChange("especialidad", event.target.value)}
            required
            placeholder="Ej: Cardiología o Dr. Pérez"
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
            <CalendarDays className="h-4 w-4" /> Fecha preferida
          </span>
          <input type="date" value={data.fecha_preferida} onChange={(event) => handleChange("fecha_preferida", event.target.value)} required className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
            <Clock className="h-4 w-4" /> Hora preferida
          </span>
          <input type="time" value={data.hora_preferida} onChange={(event) => handleChange("hora_preferida", event.target.value)} required className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
        </label>
      </div>

      <label className="space-y-2 text-sm text-[var(--foreground)]/80">
        <span className="flex items-center gap-2 font-medium text-[var(--foreground)]">
          <MessageSquare className="h-4 w-4" /> Motivo de la consulta
        </span>
        <textarea value={data.motivo} onChange={(event) => handleChange("motivo", event.target.value)} required rows={5} className="w-full rounded-[2rem] border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80" />
      </label>

      {message ? (
        <div className={`rounded-3xl border px-4 py-3 text-sm ${status === "success" ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"}`}>
          {message}
        </div>
      ) : null}

      <button disabled={status === "loading"} type="submit" className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-60">
        {status === "loading" ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}
