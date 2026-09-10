"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, CheckCircle2, FileText, Frown, Meh, Smile, Star } from "lucide-react";

type ClosureData = {
  turno: { fecha: string; hora: string; duracion_minutos: number | null };
  doctor: { nombre: string | null; especialidad: string | null; matricula?: string | null } | null;
  feedback: { id: string } | null;
  interconsulta: { id: string; especialidad_destino: string; aceptada: boolean | null; turno_generado: boolean; profesional: { nombre: string | null; especialidad: string | null; matricula?: string | null; foto_url?: string | null } | null } | null;
  proximo_turno: { id: string; fecha_preferida: string; hora_preferida: string; estado: string } | null;
};

type Stage = "loading" | "interconsulta" | "feedback" | "done" | "error";

export default function TeleconsultaClosureFlow({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [data, setData] = useState<ClosureData | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [resolved, setResolved] = useState<"si" | "parcialmente" | "no" | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setStage("loading");
    setMessage("");
    try {
      const response = await fetch(`/api/teleconsulta/${appointmentId}/closure`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setData({
            turno: { fecha: "Consulta finalizada", hora: "", duracion_minutos: null },
            doctor: null,
            feedback: null,
            interconsulta: null,
            proximo_turno: null,
          });
          setStage("done");
          return;
        }
        throw new Error(payload.error || "No se pudo cargar el cierre.");
      }
      setData(payload);
      setStage(payload.feedback ? "done" : payload.interconsulta && payload.interconsulta.aceptada === null ? "interconsulta" : "feedback");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el cierre.");
      setStage("error");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // La función load usa el appointmentId actual y se mantiene local al componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  async function submitAction(action: "accept_interconsulta" | "defer_interconsulta") {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/teleconsulta/${appointmentId}/closure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la respuesta.");
      if (action === "accept_interconsulta" && data?.interconsulta) {
        router.push(`/turnos?interconsulta_id=${encodeURIComponent(data.interconsulta.id)}&teleconsulta_id=${encodeURIComponent(appointmentId)}`);
        return;
      }
      setStage("feedback");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar la respuesta."); }
    finally { setSaving(false); }
  }

  async function submitFeedback() {
    if (!rating || !resolved) { setMessage("Seleccioná una calificación y si la consulta resolvió tu motivo."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/teleconsulta/${appointmentId}/closure`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "feedback", calificacion: rating, resolvio_motivo: resolved, comentario: comment }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar la evaluación.");
      setStage("done");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar la evaluación. Podés reintentarlo."); }
    finally { setSaving(false); }
  }

  if (stage === "loading") return <main className="min-h-screen bg-[var(--background)] px-4 py-16 text-center text-sm text-[var(--muted)]">Cargando el cierre de tu consulta...</main>;
  if (stage === "error" || !data) return <main className="min-h-screen bg-[var(--background)] px-4 py-16"><section className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-[var(--card)] p-6"><p className="text-sm text-rose-700">{message}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white">Reintentar</button></section></main>;

  const doctorName = data.doctor?.nombre || "tu profesional";
  const ratingOptions = [{ value: 1, label: "Regular", icon: Frown }, { value: 2, label: "Bien", icon: Smile }, { value: 3, label: "Excelente", icon: Smile }];

  return <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] sm:px-6 sm:py-12"><section className="mx-auto max-w-3xl">
    <div className="mb-6 text-center"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Cierre de la consulta</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">Gracias por tu tiempo</h1></div>
    {stage === "interconsulta" && data.interconsulta ? <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(14,75,78,.1)]"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--accent)]">Interconsulta sugerida</p><h2 className="mt-2 text-2xl font-semibold text-[var(--primary)]">El profesional te sugirió una interconsulta</h2><p className="mt-3 text-sm text-[var(--muted)]">Tu médico te recomienda realizar una consulta con:</p><div className="mt-5 flex items-center gap-4 rounded-2xl bg-[var(--background)] p-4">{data.interconsulta.profesional?.foto_url ? <Image src={data.interconsulta.profesional.foto_url} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]"><Star className="h-6 w-6" /></div>}<div><p className="font-semibold">{data.interconsulta.profesional?.nombre || "Profesional sugerido"}</p><p className="text-sm text-[var(--muted)]">{data.interconsulta.profesional?.especialidad || data.interconsulta.especialidad_destino}</p>{data.interconsulta.profesional?.matricula ? <p className="text-xs text-[var(--muted)]">Matrícula: {data.interconsulta.profesional.matricula}</p> : null}</div></div><p className="mt-6 font-semibold">¿Deseás solicitar un turno ahora?</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><button type="button" disabled={saving} onClick={() => void submitAction("accept_interconsulta")} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Solicitar turno <ArrowRight className="h-4 w-4" /></button><button type="button" disabled={saving} onClick={() => void submitAction("defer_interconsulta")} className="rounded-full border border-[var(--border)] px-5 py-3 text-sm font-semibold">Más tarde</button></div></section> : null}
    {stage === "feedback" ? <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(14,75,78,.1)]"><h2 className="text-2xl font-semibold text-[var(--primary)]">¿Cómo fue tu consulta?</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{ratingOptions.map(({ value, label, icon: Icon }) => <button type="button" key={value} onClick={() => setRating(value)} className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition ${rating === value ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] hover:bg-[var(--background)]"}`}><Icon className="h-10 w-10" aria-hidden="true" /><span>{label}</span></button>)}</div><label className="mt-6 block text-sm font-semibold">¿Querés contarnos algo?<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 font-normal outline-none focus:border-[var(--primary)]" /></label><fieldset className="mt-6"><legend className="text-sm font-semibold">¿La consulta resolvió tu motivo principal?</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{([{ value: "si", label: "Sí" }, { value: "parcialmente", label: "Parcialmente" }, { value: "no", label: "No" }] as const).map((option) => <button type="button" key={option.value} onClick={() => setResolved(option.value)} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${resolved === option.value ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)]"}`}>{option.label}</button>)}</div></fieldset>{message ? <p className="mt-4 text-sm text-rose-700">{message}</p> : null}<button type="button" onClick={() => void submitFeedback()} disabled={saving} className="mt-6 w-full rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando..." : "Confirmar evaluación"}</button></section> : null}
    {stage === "done" ? <section className="rounded-3xl border border-emerald-200 bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(14,75,78,.1)]"><div className="flex items-center gap-3"><CheckCircle2 className="h-7 w-7 text-emerald-700" /><h2 className="text-2xl font-semibold text-[var(--primary)]">Consulta finalizada</h2></div><p className="mt-3 text-sm">Tu teleconsulta con {doctorName} finalizó correctamente.</p><dl className="mt-6 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-[var(--muted)]">Fecha</dt><dd className="font-semibold">{data.turno.fecha}</dd></div><div><dt className="text-xs text-[var(--muted)]">Hora</dt><dd className="font-semibold">{data.turno.hora}</dd></div><div><dt className="text-xs text-[var(--muted)]">Duración</dt><dd className="font-semibold">{data.turno.duracion_minutos === null ? "No disponible" : `${data.turno.duracion_minutos} min`}</dd></div><div><dt className="text-xs text-[var(--muted)]">Profesional</dt><dd className="font-semibold">{doctorName}</dd><dd className="text-sm text-[var(--muted)]">{data.doctor?.especialidad || "Especialidad no informada"}</dd></div></dl><div className="mt-6 border-t border-[var(--border)] pt-5"><p className="font-semibold text-[var(--primary)]">Documentación de tu consulta</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Link href="/mi-cuenta#devoluciones-medicas" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-3 text-sm font-semibold"><FileText className="h-4 w-4" />Ver indicaciones</Link><Link href="/mi-cuenta#devoluciones-medicas" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-3 text-sm font-semibold"><FileText className="h-4 w-4" />Ver receta</Link><Link href="/mi-cuenta#mis-estudios" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-3 text-sm font-semibold"><FileText className="h-4 w-4" />Ver estudios</Link><Link href="/mi-cuenta#devoluciones-medicas" className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-4 py-3 text-sm font-semibold"><FileText className="h-4 w-4" />Ver documentos</Link></div></div><Link href="/mi-cuenta" className="mt-6 inline-flex w-full justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white">Volver al inicio</Link></section> : null}
    {stage === "done" ? <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"><p className="font-semibold text-[var(--primary)]">Próximo control</p>{data.proximo_turno ? <><p className="mt-2 text-sm">{data.proximo_turno.fecha_preferida} · {data.proximo_turno.hora_preferida.slice(0, 5)} hs</p><Link href="/mi-cuenta#mis-turnos" className="mt-3 inline-flex rounded-full border border-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary)]">Ver turno</Link></> : <p className="mt-2 text-sm text-[var(--muted)]">No hay un próximo turno registrado.</p>}</section> : null}
  </section></main>;
}
