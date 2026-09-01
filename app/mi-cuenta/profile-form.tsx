"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

import Link from "next/link";

type Status = "idle" | "loading" | "success" | "error";

export default function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"patient" | "doctor" | "">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [documento, setDocumento] = useState("");
  const [sexo, setSexo] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [obraSocial, setObraSocial] = useState("");
  const [profesion, setProfesion] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !data?.user) {
        setMessage("No se pudo cargar tu perfil. Vuelve a iniciar sesión.");
        setStatus("error");
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const user = data.user;
      const metadata = user.user_metadata ?? {};

      let pacienteRow: any = null;
      let doctorRow: any = null;
      if ((metadata.role as string) === "doctor") {
        try {
          const { data: doctorData, error: doctorError } = await supabase
            .from("doctors")
            .select("nombre, profesion, especialidad, telefono, documento, sexo, estado_civil, obra_social")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!mounted) return;
          if (doctorError) {
            console.warn("No se pudo leer fila doctors:", doctorError.message);
          } else {
            doctorRow = doctorData;
          }
        } catch (e) {
          console.warn(e);
        }
      }

      if ((metadata.role as string) !== "doctor") {
        try {
          const { data: pacienteData, error: pacienteError } = await supabase
            .from("pacientes")
            .select("id, nombre, email, telefono, documento, sexo, estado_civil, obra_social, profesion")
            .eq("email", user.email)
            .maybeSingle();
          if (!mounted) return;
          if (pacienteError) {
            console.warn("No se pudo leer fila pacientes:", pacienteError.message);
          } else {
            pacienteRow = pacienteData;
          }
        } catch (e) {
          console.warn(e);
        }
      }

      setEmail(user.email ?? "");
      setRole((metadata.role as "patient" | "doctor") ?? "patient");

      const telefonoFromRow = doctorRow?.telefono ?? pacienteRow?.telefono ?? undefined;
      const documentoFromRow = doctorRow?.documento ?? pacienteRow?.documento ?? undefined;
      const sexoFromRow = doctorRow?.sexo ?? pacienteRow?.sexo ?? undefined;
      const estadoCivilFromRow = doctorRow?.estado_civil ?? pacienteRow?.estado_civil ?? undefined;
      const obraSocialFromRow = doctorRow?.obra_social ?? pacienteRow?.obra_social ?? undefined;
      const profesionFromRow = doctorRow?.profesion ?? pacienteRow?.profesion ?? undefined;
      const especialidadFromRow = doctorRow?.especialidad ?? undefined;

      const fullName = metadata.full_name ?? "";
      const firstFromMeta = metadata.first_name ?? fullName.split(" ")[0] ?? "";
      const lastFromMeta = metadata.last_name ?? "";

      setFirstName(firstFromMeta ?? "");
      setLastName(lastFromMeta ?? "");
      setDocumento(documentoFromRow ?? metadata.documento ?? "");
      setSexo(sexoFromRow ?? metadata.sexo ?? "");
      setEstadoCivil(estadoCivilFromRow ?? metadata.estado_civil ?? "");
      setObraSocial(obraSocialFromRow ?? metadata.obra_social ?? "");
      setProfesion(profesionFromRow ?? metadata.profesion ?? "");
      setEspecialidad(especialidadFromRow ?? metadata.especialidad ?? "");
      setTelefono(telefonoFromRow ?? metadata.telefono ?? metadata.phone ?? "");
      setAuthenticated(true);
      setLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setStatus("error");
      setMessage("Ingresa nombre y apellido válidos.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        role: role || "patient",
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: `${trimmedFirstName} ${trimmedLastName}`,
        documento: documento.trim() || null,
        sexo: sexo.trim() || null,
        estado_civil: estadoCivil.trim() || null,
        obra_social: obraSocial.trim() || null,
        profesion: profesion.trim() || null,
        especialidad: role === "doctor" ? especialidad.trim() || null : null,
        telefono: telefono.trim() || null,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    try {
      if (role === "doctor") {
        const { data: currentUser } = await supabase.auth.getUser();
        const userId = currentUser?.user?.id;
        if (userId) {
          const doctorPayload: any = {
            user_id: userId,
            nombre: `${trimmedFirstName} ${trimmedLastName}`,
            profesion: profesion.trim() || null,
            especialidad: especialidad.trim() || null,
            telefono: telefono.trim() || null,
            documento: documento.trim() || null,
            sexo: sexo.trim() || null,
            estado_civil: estadoCivil.trim() || null,
            obra_social: obraSocial.trim() || null,
            metadata: {
              role: role,
              first_name: trimmedFirstName,
              last_name: trimmedLastName,
              full_name: `${trimmedFirstName} ${trimmedLastName}`,
              documento: documento.trim() || null,
              sexo: sexo.trim() || null,
              estado_civil: estadoCivil.trim() || null,
              obra_social: obraSocial.trim() || null,
              profesion: profesion.trim() || null,
              especialidad: especialidad.trim() || null,
              telefono: telefono.trim() || null,
            },
          };

          const { error: upsertError } = await supabase.from("doctors").upsert(doctorPayload, { onConflict: ["user_id"] });
          if (upsertError) {
            console.warn("Error actualizando tabla doctors:", upsertError.message);
          }
        }
      } else {
        const pacientePayload: any = {
          email: email || undefined,
          nombre: `${trimmedFirstName} ${trimmedLastName}`,
          telefono: telefono.trim() || null,
          documento: documento.trim() || null,
          sexo: sexo.trim() || null,
          estado_civil: estadoCivil.trim() || null,
          obra_social: obraSocial.trim() || null,
          profesion: profesion.trim() || null,
        };

        const { error: upsertError } = await supabase.from("pacientes").upsert(pacientePayload, { onConflict: ["email"] });
        if (upsertError) {
          console.warn("Error actualizando tabla pacientes:", upsertError.message);
        }
      }
    } catch (e) {
      console.warn(e);
    }

    setStatus("success");
    setMessage("Tus datos se actualizaron correctamente.");
  };

  if (loading) {
    return <p className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-6 text-sm text-[var(--foreground)]/80">Cargando tu perfil...</p>;
  }

  if (!authenticated) {
    return (
      <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--background)] p-6 text-sm text-[var(--foreground)]/80">
        <p className="font-semibold text-[var(--foreground)]">Sesión inválida</p>
        <p className="mt-2">Iniciá sesión para ver y actualizar tus datos personales.</p>
        <Link href="/login" className="mt-4 inline-flex rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90">
          Ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Nombre</span>
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Apellido</span>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Email de registro</span>
          <input
            type="email"
            value={email}
            disabled
            className="w-full cursor-not-allowed rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)]/70 outline-none"
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Teléfono</span>
          <input
            type="tel"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
      </div>

      {role === "doctor" ? (
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Especialidad</span>
          <input
            type="text"
            value={especialidad}
            onChange={(event) => setEspecialidad(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Documento</span>
          <input
            type="text"
            value={documento}
            onChange={(event) => setDocumento(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Sexo</span>
          <select
            value={sexo}
            onChange={(event) => setSexo(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          >
            <option value="">Seleccionar</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Estado civil</span>
          <input
            type="text"
            value={estadoCivil}
            onChange={(event) => setEstadoCivil(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
        <label className="space-y-2 text-sm text-[var(--foreground)]/80">
          <span>Obra social</span>
          <input
            type="text"
            value={obraSocial}
            onChange={(event) => setObraSocial(event.target.value)}
            className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
          />
        </label>
      </div>

      <label className="space-y-2 text-sm text-[var(--foreground)]/80">
        <span>Profesión</span>
        <input
          type="text"
          value={profesion}
          onChange={(event) => setProfesion(event.target.value)}
          className="w-full rounded-3xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 outline-none transition focus:border-[var(--primary)]/80"
        />
      </label>

      {message ? (
        <div className={`rounded-3xl border px-4 py-3 text-sm ${status === "success" ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"}`}>
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Guardar cambios
      </button>
    </form>
  );
}
