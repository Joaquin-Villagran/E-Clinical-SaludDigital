"use client";

import { FormEvent, useState } from "react";
import { Camera, Save } from "lucide-react";

type DoctorProfile = {
  nombre: string | null;
  documento: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  nacionalidad: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  provincia: string | null;
  foto_url: string | null;
  matricula: string | null;
  tipo_matricula: string | null;
  especialidad: string | null;
};

type Props = { doctor: DoctorProfile };

function text(value: string | null) {
  return value ?? "";
}

// Formularios separados: guardar contacto nunca modifica las credenciales profesionales, y viceversa.
export default function DoctorProfileForm({ doctor }: Props) {
  const [personal, setPersonal] = useState({ nombre: text(doctor.nombre), documento: text(doctor.documento), fecha_nacimiento: text(doctor.fecha_nacimiento), sexo: text(doctor.sexo), nacionalidad: text(doctor.nacionalidad) });
  const [contact, setContact] = useState({ telefono: text(doctor.telefono), direccion: text(doctor.direccion), ciudad: text(doctor.ciudad), provincia: text(doctor.provincia), foto_url: text(doctor.foto_url) });
  const [professional, setProfessional] = useState({ matricula: text(doctor.matricula), tipo_matricula: text(doctor.tipo_matricula), especialidad: text(doctor.especialidad) });
  const [status, setStatus] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function save(section: "personales" | "contacto" | "profesional", values: Record<string, string>) {
    setSaving(section);
    setStatus((current) => ({ ...current, [section]: "" }));
    try {
      const response = await fetch("/api/doctors/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, ...values }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la sección.");
      setStatus((current) => ({ ...current, [section]: "Cambios guardados." }));
    } catch (error) {
      setStatus((current) => ({ ...current, [section]: error instanceof Error ? error.message : "No se pudo guardar la sección." }));
    } finally {
      setSaving(null);
    }
  }

  function handlePersonal(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save("personales", personal); }
  function handleContact(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save("contacto", contact); }
  function handleProfessional(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void save("profesional", professional); }

  return <div className="grid gap-6 lg:grid-cols-2">
    <form onSubmit={handlePersonal} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_36px_rgba(14,75,78,0.08)] lg:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Editable</p><h2 className="mt-1 text-xl font-semibold text-[var(--primary)]">Datos personales</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><label className="text-sm lg:col-span-2">Nombre completo<input required value={personal.nombre} onChange={(event) => setPersonal({ ...personal, nombre: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">DNI<input required inputMode="numeric" value={personal.documento} onChange={(event) => setPersonal({ ...personal, documento: event.target.value.replace(/\D/g, "") })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Nacimiento<input type="date" value={personal.fecha_nacimiento} onChange={(event) => setPersonal({ ...personal, fecha_nacimiento: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Sexo<select value={personal.sexo} onChange={(event) => setPersonal({ ...personal, sexo: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"><option value="">Seleccionar</option><option value="Femenino">Femenino</option><option value="Masculino">Masculino</option><option value="Otro">Otro</option></select></label><label className="text-sm lg:col-span-2">Nacionalidad<input value={personal.nacionalidad} onChange={(event) => setPersonal({ ...personal, nacionalidad: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label></div>
      {status.personales ? <p className="mt-4 text-sm text-[var(--primary)]">{status.personales}</p> : null}<button disabled={saving === "personales"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving === "personales" ? "Guardando..." : "Guardar datos personales"}</button>
    </form>
    <form onSubmit={handleContact} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_36px_rgba(14,75,78,0.08)]">
      <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[var(--accent)]"><Camera className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Editable</p><h2 className="text-xl font-semibold text-[var(--primary)]">Datos de contacto</h2></div></div>
      <p className="mt-4 text-sm text-[var(--muted)]">Email de registro: <span className="font-medium text-[var(--foreground)]">{doctor.email ?? "No informado"}</span></p>
      <div className="mt-5 grid gap-4"><label className="text-sm">Teléfono<input value={contact.telefono} onChange={(event) => setContact({ ...contact, telefono: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Domicilio<input value={contact.direccion} onChange={(event) => setContact({ ...contact, direccion: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Ciudad<input value={contact.ciudad} onChange={(event) => setContact({ ...contact, ciudad: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Provincia<input value={contact.provincia} onChange={(event) => setContact({ ...contact, provincia: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label></div><label className="text-sm">URL externa de foto<input type="url" placeholder="https://..." value={contact.foto_url} onChange={(event) => setContact({ ...contact, foto_url: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label></div>
      {status.contacto ? <p className="mt-4 text-sm text-[var(--primary)]">{status.contacto}</p> : null}<button disabled={saving === "contacto"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving === "contacto" ? "Guardando..." : "Guardar contacto"}</button>
    </form>
    <form onSubmit={handleProfessional} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_36px_rgba(14,75,78,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Editable</p><h2 className="mt-1 text-xl font-semibold text-[var(--primary)]">Datos profesionales</h2>
      <div className="mt-5 grid gap-4"><label className="text-sm">Matrícula<input value={professional.matricula} onChange={(event) => setProfessional({ ...professional, matricula: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Tipo de matrícula<input value={professional.tipo_matricula} onChange={(event) => setProfessional({ ...professional, tipo_matricula: event.target.value })} placeholder="Nacional, provincial..." className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label><label className="text-sm">Especialidad<input value={professional.especialidad} onChange={(event) => setProfessional({ ...professional, especialidad: event.target.value })} className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2" /></label></div>
      {status.profesional ? <p className="mt-4 text-sm text-[var(--primary)]">{status.profesional}</p> : null}<button disabled={saving === "profesional"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving === "profesional" ? "Guardando..." : "Guardar datos profesionales"}</button>
    </form>
  </div>;
}