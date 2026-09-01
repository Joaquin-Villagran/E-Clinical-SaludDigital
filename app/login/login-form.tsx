"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { Lock, Mail, User } from "lucide-react";

interface LoginFormProps {
  confirmed?: boolean;
  /** Initial mode to show: 'login' or 'signup' */
  initialMode?: "login" | "signup";
  /** Force a specific account type and optionally hide the account picker */
  forceAccountType?: "patient" | "doctor";
  hideAccountPicker?: boolean;
  /** Render as a single-column layout (no responsive split) */
  singleColumn?: boolean;
}

export default function LoginForm({ confirmed, initialMode, forceAccountType, hideAccountPicker, singleColumn }: LoginFormProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode ?? "login");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [documento, setDocumento] = useState("");
  const [sexo, setSexo] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [obraSocial, setObraSocial] = useState("");
  const [profesion, setProfesion] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [accountType, setAccountType] = useState<"patient" | "doctor">(forceAccountType ?? "patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const router = useRouter();

  const roleDescriptions: Record<"patient" | "doctor", string> = {
    patient: "Paciente: solicitá turnos y consultá tus resultados desde tu espacio personal.",
    doctor: "Profesional: accedé a agenda, pacientes y resultados con permisos de médico.",
  };

  const roleLabel = accountType === "doctor" ? "Profesional" : "Paciente";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const trimmedEmail = email.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedEmail || !password) {
      setStatus("error");
      setMessage("Completa email y contraseña.");
      return;
    }

    if (mode === "signup") {
      if (!trimmedFirstName || !trimmedLastName) {
        setStatus("error");
        setMessage("Ingresa tu nombre y apellido para registrarte.");
        return;
      }
      if (!documento.trim() || !sexo.trim() || !estadoCivil.trim() || !obraSocial.trim() || !profesion.trim() || !telefono.trim()) {
        setStatus("error");
        setMessage("Completa todos los datos del perfil para registrarte.");
        return;
      }
      if (accountType === "doctor" && !especialidad.trim()) {
        setStatus("error");
        setMessage("Indica tu especialidad para completar el registro médico.");
        return;
      }

      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/login?confirmed=true` : undefined;
      const { error } = await supabase.auth.signUp(
        { email: trimmedEmail, password },
        {
          data: {
            role: accountType,
            full_name: `${trimmedFirstName} ${trimmedLastName}`,
            first_name: trimmedFirstName,
            last_name: trimmedLastName,
            documento: documento.trim(),
            sexo: sexo.trim(),
            estado_civil: estadoCivil.trim(),
            obra_social: obraSocial.trim(),
            profesion: profesion.trim(),
            especialidad: especialidad.trim() || null,
            telefono: telefono.trim(),
          },
          emailRedirectTo: redirectTo,
        }
      );

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setStatus("success");
      setMessage(`Registro enviado. Revisa ${trimmedEmail} para activar tu cuenta y luego inicia sesión.`);
      setPassword("");
      setFirstName("");
      setLastName("");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    if (!data?.session) {
      setStatus("error");
      setMessage("No se pudo iniciar sesión. Intenta nuevamente.");
      return;
    }

    const role = data.user?.user_metadata?.role as string | undefined;
    setStatus("success");
    setMessage("Inicio de sesión exitoso. Redirigiendo...");
    router.replace(role === "doctor" ? "/panel" : "/mi-cuenta");
  };

  const isLogin = mode === "login";
  const formTitle = isLogin ? "Ingresar" : "Crear cuenta";
  const formSubtitle = isLogin
    ? "Accedé a tu espacio seguro como paciente o profesional."
    : "Registrate con tu perfil y comenzá a usar el sistema inmediatamente.";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className={`grid gap-8 ${singleColumn ? "" : "lg:grid-cols-[1.3fr_0.9fr]"}`}>
          <section className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--card)] p-8 shadow-[0_30px_90px_rgba(14,75,78,0.08)]">
          <div className="mb-8 flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Acceso seguro</p>
              <h1 className="text-4xl font-semibold text-[var(--primary)]">{formTitle}</h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--foreground)]/80 mx-auto sm:mx-0">{formSubtitle}</p>
            </div>
            <div className="inline-flex flex-col gap-3 rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`w-full rounded-[1.5rem] px-6 py-3 text-sm font-semibold transition ${
                  isLogin
                    ? "bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/20"
                    : "text-[var(--foreground)] hover:text-[var(--primary)]"
                }`}
              >
                Ingresar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`w-full rounded-[1.5rem] px-6 py-3 text-sm font-semibold transition ${
                  !isLogin
                    ? "bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/20"
                    : "text-[var(--foreground)] hover:text-[var(--primary)]"
                }`}
              >
                Registrarse
              </button>
            </div>
          </div>

          {!hideAccountPicker ? (
            <div className="grid gap-4 mb-8">
              <div
                className={`rounded-[2rem] border p-6 transition ${
                  accountType === "patient" ? "border-[var(--primary)] bg-[var(--primary)]/15 shadow-[0_15px_35px_rgba(79,70,229,0.12)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/70"
                }`}
              >
                <button type="button" onClick={() => setAccountType("patient")} aria-pressed={accountType === "patient"} className="flex w-full items-center gap-4 text-left">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--accent)] text-lg font-bold text-white">PT</span>
                  <div>
                    <p className="text-xl font-semibold text-[var(--foreground)]">Paciente</p>
                    <p className="mt-2 text-base text-[var(--foreground)]/80">Reservá turnos y consultá tus estudios en un solo lugar.</p>
                  </div>
                </button>
              </div>

              <div
                className={`rounded-[2rem] border p-6 transition ${
                  accountType === "doctor" ? "border-[var(--primary)] bg-[var(--primary)]/15 shadow-[0_15px_35px_rgba(79,70,229,0.12)]" : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/70"
                }`}
              >
                <button type="button" onClick={() => setAccountType("doctor")} aria-pressed={accountType === "doctor"} className="flex w-full items-center gap-4 text-left">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-[var(--primary)] text-lg font-bold text-white">DR</span>
                  <div>
                    <p className="text-xl font-semibold text-[var(--foreground)]">Profesional</p>
                    <p className="mt-2 text-base text-[var(--foreground)]/80">Accedé al panel médico con agenda y pacientes.</p>
                  </div>
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--background)] p-6">
              <div className="grid gap-5">
                {mode === "signup" ? (
                  <>
                    <label className="space-y-3 text-base text-[var(--foreground)]">
                      <span className="flex items-center gap-3 font-semibold text-[var(--foreground)]">
                        <User className="h-5 w-5" /> Nombre completo
                      </span>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                        className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                      />
                    </label>
                    <label className="space-y-3 text-base text-[var(--foreground)]">
                      <span className="flex items-center gap-3 font-semibold text-[var(--foreground)]">
                        <User className="h-5 w-5" /> Apellido
                      </span>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                        className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                      />
                    </label>
                  </>
                ) : null}

                <label className="space-y-3 text-base text-[var(--foreground)]">
                  <span className="flex items-center gap-3 font-semibold text-[var(--foreground)]">
                    <Mail className="h-5 w-5" /> Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                  />
                </label>
                <label className="space-y-3 text-base text-[var(--foreground)]">
                  <span className="flex items-center gap-3 font-semibold text-[var(--foreground)]">
                    <Lock className="h-5 w-5" /> Contraseña
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)]/80 transition hover:border-[var(--primary)]/80 hover:text-[var(--foreground)]"
                    >
                      {showPassword ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                </label>
              </div>

              {mode === "signup" ? (
                <div className="mt-6 grid gap-5">
                  <label className="space-y-3 text-base text-[var(--foreground)]">
                    <span className="font-semibold">Documento</span>
                    <input
                      type="text"
                      value={documento}
                      onChange={(event) => setDocumento(event.target.value)}
                      required
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    />
                  </label>
                  <label className="space-y-3 text-base text-[var(--foreground)]">
                    <span className="font-semibold">Teléfono</span>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(event) => setTelefono(event.target.value)}
                      required
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    />
                  </label>
                  <label className="space-y-3 text-base text-[var(--foreground)]">
                    <span className="font-semibold">Sexo</span>
                    <select
                      value={sexo}
                      onChange={(event) => setSexo(event.target.value)}
                      required
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    >
                      <option value="">Seleccionar</option>
                      <option value="Femenino">Femenino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </label>
                  <label className="space-y-3 text-base text-[var(--foreground)]">
                    <span className="font-semibold">Estado civil</span>
                    <input
                      type="text"
                      value={estadoCivil}
                      onChange={(event) => setEstadoCivil(event.target.value)}
                      required
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    />
                  </label>
                  <label className="space-y-3 text-base text-[var(--foreground)]">
                    <span className="font-semibold">Obra social</span>
                    <input
                      type="text"
                      value={obraSocial}
                      onChange={(event) => setObraSocial(event.target.value)}
                      required
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    />
                  </label>
                  <label className="space-y-3 text-base text-[var(--foreground)]">
                    <span className="font-semibold">Profesión</span>
                    <input
                      type="text"
                      value={profesion}
                      onChange={(event) => setProfesion(event.target.value)}
                      required
                      className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                    />
                  </label>
                  {accountType === "doctor" ? (
                    <label className="space-y-3 text-base text-[var(--foreground)]">
                      <span className="font-semibold">Especialidad</span>
                      <input
                        type="text"
                        value={especialidad}
                        onChange={(event) => setEspecialidad(event.target.value)}
                        required
                        className="w-full rounded-[2rem] border border-[var(--border)] bg-white px-5 py-4 text-lg outline-none transition focus:border-[var(--primary)]/80"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>

            {message ? (
              <div className={`rounded-3xl border px-4 py-3 text-sm ${status === "success" ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]"}`}>
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-full bg-[var(--primary)] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[var(--primary)]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "login" ? "Ingresar" : "Crear cuenta"}
            </button>

            <div className="flex flex-col items-center justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--background)] px-5 py-4 text-sm text-[var(--foreground)]/75 sm:flex-row">
              <p>{mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}</p>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setMessage("");
                }}
                className="font-medium text-[var(--primary)] transition hover:text-[var(--primary)]/90"
              >
                {mode === "login" ? "Regístrate" : "Inicia sesión"}
              </button>
            </div>
          </form>
        </section>
        </div>
      </div>
    </div>
  );
}
