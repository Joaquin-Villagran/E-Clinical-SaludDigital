"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Trash2 } from "lucide-react";

const inputClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm";
const weekLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
type Block = { id: string; hora_inicio: string; hora_fin: string; intervalo_minutos: number };
type ManagedSlot = { value: string; fecha: string; hora: string; reservado: boolean; cancelado: boolean };
type Mode = "calendario" | "fecha";

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calendarDays(month: Date) {
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
}

export default function AvailabilityForm({ doctorId }: { doctorId: string }) {
  const today = useMemo(() => formatDate(new Date()), []);
  const [mode, setMode] = useState<Mode>("calendario");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [interval, setInterval] = useState("30");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [managedSlots, setManagedSlots] = useState<ManagedSlot[]>([]);
  const [selectedSlotValues, setSelectedSlotValues] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => calendarDays(month), [month]);
  const publishDates = mode === "fecha" ? (date ? [date] : []) : selectedDates;
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  const slotsPerDay = endMinutes > startMinutes ? Math.floor((endMinutes - startMinutes) / Number(interval || 1)) : 0;

  useEffect(() => {
    if (!doctorId) { setSelectedDates([]); return; }
    fetch(`/api/disponibilidad?doctor_id=${doctorId}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        const dates = Array.from(new Set((result.blocks ?? []).map((block: Block & { fecha?: string }) => block.fecha).filter(Boolean))) as string[];
        setSelectedDates(dates.sort());
      })
      .catch(() => setSelectedDates([]));
  }, [doctorId]);

  useEffect(() => {
    setSelectedSlotValues([]);
    if (!date || mode !== "fecha") { setBlocks([]); setManagedSlots([]); return; }
    fetch(`/api/disponibilidad?doctor_id=${doctorId}&fecha=${date}`)
      .then((response) => response.json())
      .then((result) => { setBlocks(result.blocks ?? []); setManagedSlots(result.managedSlots ?? []); })
      .catch(() => { setBlocks([]); setManagedSlots([]); });
  }, [date, doctorId, mode]);

  function toggleDate(value: string) {
    setSelectedDates((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    try {
      if (!publishDates.length) throw new Error(mode === "fecha" ? "Elegí una fecha." : "Seleccioná días en el calendario.");
      if (!slotsPerDay) throw new Error("Revisá Desde, Hasta e intervalo.");
      const response = await fetch("/api/disponibilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechas: publishDates, hora_inicio: start, hora_fin: end, intervalo_minutos: Number(interval) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo publicar.");
      setMessage(`${publishDates.length} día${publishDates.length === 1 ? "" : "s"} publicado${publishDates.length === 1 ? "" : "s"}.`);
      if (mode === "calendario") setSelectedDates([]);
      else setBlocks((await (await fetch(`/api/disponibilidad?doctor_id=${doctorId}&fecha=${date}`)).json()).blocks ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo publicar."); }
    finally { setSaving(false); }
  }

  async function deleteDay() {
    if (!date || !window.confirm(`¿Eliminar disponibilidad del ${date}?`)) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/disponibilidad?fecha=${date}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo eliminar.");
      setBlocks([]); setManagedSlots([]); setSelectedSlotValues([]); setMessage("Día cancelado.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo eliminar."); }
    finally { setSaving(false); }
  }

  async function deleteSelectedSlots() {
    if (!selectedSlotValues.length || !window.confirm(`¿Cancelar ${selectedSlotValues.length} turno${selectedSlotValues.length === 1 ? "" : "s"} seleccionado${selectedSlotValues.length === 1 ? "" : "s"}?`)) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/disponibilidad?slots=${encodeURIComponent(selectedSlotValues.join(","))}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudieron cancelar los turnos.");
      setManagedSlots((current) => current.map((slot) => selectedSlotValues.includes(slot.value) ? { ...slot, cancelado: true } : slot));
      setSelectedSlotValues([]);
      setMessage("Turnos cancelados. El resto de la jornada sigue disponible.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron cancelar los turnos."); }
    finally { setSaving(false); }
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-[0_12px_36px_rgba(14,75,78,0.06)]">
      <header className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><CalendarDays className="h-4 w-4" /></span>
        <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--accent)]">Disponibilidad</p><h2 className="text-xl font-semibold text-[var(--primary)]">Publicá tus horarios</h2><p className="text-xs text-[var(--muted)]">Elegí días y definí una jornada.</p></div>
      </header>
      <div className="mt-4 grid grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-1 text-xs">
        <button type="button" onClick={() => setMode("calendario")} className={`rounded-lg px-3 py-2 font-semibold ${mode === "calendario" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>Calendario</button>
        <button type="button" onClick={() => setMode("fecha")} className={`rounded-lg px-3 py-2 font-semibold ${mode === "fecha" ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>Administrar día</button>
      </div>
      <form onSubmit={submit} className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 lg:row-span-3">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-[var(--primary)]">{mode === "fecha" ? "Día a administrar" : "Días disponibles"}</h3>{mode === "calendario" ? <span className="text-xs text-[var(--muted)]">{selectedDates.length} elegidos</span> : null}</div>
          {mode === "fecha" ? <label className="block max-w-xs text-xs font-semibold">Fecha<input required type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label> : <>
            <div className="mx-auto mb-2 flex max-w-[19rem] items-center justify-between"><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)]" aria-label="Mes anterior"><ChevronLeft className="h-3.5 w-3.5" /></button><p className="text-sm font-semibold capitalize text-[var(--primary)]">{month.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p><button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)]" aria-label="Mes siguiente"><ChevronRight className="h-3.5 w-3.5" /></button></div>
            <div className="mx-auto grid max-w-[19rem] grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--muted)]">{weekLabels.map((label) => <span key={label} className="w-8 py-1">{label}</span>)}{days.map((day, index) => day ? (() => { const value = formatDate(day); const selected = selectedDates.includes(value); const past = value < today; return <button type="button" key={value} disabled={past} aria-pressed={selected} onClick={() => toggleDate(value)} className={`relative h-8 w-8 rounded-lg text-xs font-semibold ${past ? "text-[var(--border)]" : selected ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)] hover:bg-[var(--primary)]/10"}`}>{day.getDate()}{selected ? <Check className="absolute right-0.5 top-0.5 h-2.5 w-2.5" /> : null}</button>; })() : <span key={`empty-${index}`} className="h-8 w-8" />)}</div>
          </>}
        </div>
        <div className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4"><label className="text-xs font-semibold"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />Desde</span><input required type="time" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} /></label><label className="text-xs font-semibold"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />Hasta</span><input required type="time" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} /></label><label className="text-xs font-semibold">Intervalo (min)<input required type="number" min="5" max="240" step="1" value={interval} onChange={(event) => setInterval(event.target.value)} className={inputClass} /></label></div>
        <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-4 py-3 text-xs">{publishDates.length} día{publishDates.length === 1 ? "" : "s"} · {slotsPerDay} turnos por día · {publishDates.length * slotsPerDay} en total</div>
        <div className="flex flex-wrap items-center gap-2"><button disabled={saving || !publishDates.length || !slotsPerDay} className="rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Guardando..." : "Publicar días seleccionados"}</button>{message ? <span className="text-xs text-[var(--primary)]">{message}</span> : null}</div>
      </form>
      {mode === "fecha" && date ? <div className="mt-4 border-t border-[var(--border)] pt-4"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold text-[var(--primary)]">Turnos activos de {date}</p><p className="mt-1 text-[10px] text-[var(--muted)]">Seleccioná los turnos puntuales que ya no podés atender.</p></div><button type="button" onClick={deleteDay} disabled={saving || !blocks.length} className="rounded-full border border-rose-300 px-3 py-1.5 text-[10px] font-semibold text-rose-700 disabled:opacity-50"><Trash2 className="mr-1 inline h-3 w-3" />Cancelar día completo</button></div>{managedSlots.filter((slot) => !slot.cancelado).length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{managedSlots.filter((slot) => !slot.cancelado).map((slot) => <label key={slot.value} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-3 ${slot.reservado ? "border-[var(--border)] bg-[var(--background)]/60" : "cursor-pointer border-[var(--border)] bg-[var(--background)]"}`}><span className="flex items-center gap-3 text-xs text-[var(--primary)]"><input type="checkbox" disabled={slot.reservado} checked={selectedSlotValues.includes(slot.value)} onChange={(event) => setSelectedSlotValues((current) => event.target.checked ? [...current, slot.value] : current.filter((value) => value !== slot.value))} className="h-4 w-4 accent-[var(--primary)]" />{slot.hora} {slot.reservado ? <span className="text-[var(--muted)]">(reservado)</span> : null}</span></label>)}</div> : <p className="mt-2 text-xs text-[var(--muted)]">No hay turnos activos para cancelar.</p>}<button type="button" onClick={() => void deleteSelectedSlots()} disabled={saving || !selectedSlotValues.length} className="mt-3 rounded-full bg-rose-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Trash2 className="mr-1 inline h-3 w-3" />Cancelar turnos seleccionados ({selectedSlotValues.length})</button></div> : null}
    </section>
  );
}
