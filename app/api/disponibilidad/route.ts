import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

function isDoctor(session: { user?: { user_metadata?: { role?: string } } } | null) {
  return session?.user?.user_metadata?.role === "doctor";
}

export async function GET(request: NextRequest) {
  const server = await createServerSupabase();
  const { data: { session } } = await server.auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const doctorId = params.get("doctor_id");
  const fecha = params.get("fecha");
  if (!doctorId) return NextResponse.json({ error: "Falta el médico." }, { status: 400 });

  const supabase = createAdminSupabase();
  let availabilityQuery = supabase.from("doctor_disponibilidades").select("id, fecha, hora_inicio, hora_fin, intervalo_minutos").eq("doctor_id", doctorId).eq("activo", true).order("fecha").order("hora_inicio");
  if (fecha) availabilityQuery = availabilityQuery.eq("fecha", fecha);
  else availabilityQuery = availabilityQuery.gte("fecha", new Date().toISOString().slice(0, 10)).limit(365);
  const availability = await availabilityQuery;
  if (availability.error) return NextResponse.json({ error: availability.error.message }, { status: 500 });

  let bookedQuery = supabase.from("turnos").select("fecha_preferida, hora_preferida").eq("doctor_id", doctorId).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]);
  if (fecha) bookedQuery = bookedQuery.eq("fecha_preferida", fecha);
  else bookedQuery = bookedQuery.gte("fecha_preferida", new Date().toISOString().slice(0, 10));
  const booked = await bookedQuery;
  if (booked.error) return NextResponse.json({ error: booked.error.message }, { status: 500 });
  const bookedTimes = new Set((booked.data ?? []).map((row) => `${row.fecha_preferida}|${String(row.hora_preferida).slice(0, 5)}`));
  const exclusionQuery = supabase.from("doctor_disponibilidad_exclusiones").select("fecha, hora").eq("doctor_id", doctorId);
  const exclusionsResult = fecha ? await exclusionQuery.eq("fecha", fecha) : await exclusionQuery.gte("fecha", new Date().toISOString().slice(0, 10));
  if (exclusionsResult.error) return NextResponse.json({ error: exclusionsResult.error.message }, { status: 500 });
  const excludedTimes = new Set((exclusionsResult.data ?? []).map((row) => `${row.fecha}|${String(row.hora).slice(0, 5)}`));
  const slots: string[] = [];
  const appointments: Array<{ value: string; fecha: string; hora: string; label: string }> = [];
  const managedSlots: Array<{ value: string; fecha: string; hora: string; reservado: boolean; cancelado: boolean }> = [];

  for (const block of availability.data ?? []) {
    const [startHour, startMinute] = String(block.hora_inicio).slice(0, 5).split(":").map(Number);
    const [endHour, endMinute] = String(block.hora_fin).slice(0, 5).split(":").map(Number);
    for (let minutes = startHour * 60 + startMinute; minutes < endHour * 60 + endMinute; minutes += block.intervalo_minutos) {
      const slot = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      const appointmentKey = `${block.fecha}|${slot}`;
      const reservado = bookedTimes.has(appointmentKey);
      const cancelado = excludedTimes.has(appointmentKey);
      if (fecha) managedSlots.push({ value: appointmentKey, fecha: block.fecha, hora: slot, reservado, cancelado });
      if (!reservado && !cancelado) {
        slots.push(slot);
        const dateLabel = new Date(`${block.fecha}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
        appointments.push({ value: `${block.fecha}|${slot}`, fecha: block.fecha, hora: slot, label: `${dateLabel} · ${slot} hs` });
      }
    }
  }
  return NextResponse.json({ slots, appointments, blocks: availability.data ?? [], managedSlots });
}

export async function POST(request: NextRequest) {
  const server = await createServerSupabase();
  const { data: { session } } = await server.auth.getSession();
  if (!isDoctor(session)) return NextResponse.json({ error: "Sólo los médicos pueden publicar horarios." }, { status: 403 });

  const body = await request.json();
  const { fecha, fechas, hora_inicio, hora_fin, intervalo_minutos = 30 } = body;
  const selectedDates = Array.isArray(fechas) ? fechas.filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) : fecha ? [fecha] : [];
  const interval = Number(intervalo_minutos);
  if (!selectedDates.length || !hora_inicio || !hora_fin) return NextResponse.json({ error: "Completá las fechas, hora de inicio y hora de fin." }, { status: 400 });
  if (!Number.isInteger(interval) || interval < 5 || interval > 240) return NextResponse.json({ error: "El intervalo debe ser un número entero entre 5 y 240 minutos." }, { status: 400 });
  if (hora_fin <= hora_inicio) return NextResponse.json({ error: "La hora de fin debe ser posterior a la hora de inicio." }, { status: 400 });

  const supabase = createAdminSupabase();
  const doctor = await supabase.from("doctors").select("id").eq("user_id", session!.user!.id).single();
  if (doctor.error) return NextResponse.json({ error: "No se encontró el perfil médico." }, { status: 404 });
  const result = await supabase.from("doctor_disponibilidades").upsert(selectedDates.map((selectedDate) => ({ doctor_id: doctor.data.id, fecha: selectedDate, hora_inicio, hora_fin, intervalo_minutos: interval, activo: true })), { onConflict: "doctor_id,fecha,hora_inicio,hora_fin" }).select();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, disponibilidad: result.data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const server = await createServerSupabase();
  const { data: { session } } = await server.auth.getSession();
  if (!isDoctor(session)) return NextResponse.json({ error: "Sólo los médicos pueden eliminar horarios." }, { status: 403 });

  const fecha = request.nextUrl.searchParams.get("fecha");
  const blockId = request.nextUrl.searchParams.get("id");
  const blockIds = (request.nextUrl.searchParams.get("ids") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const slotValues = (request.nextUrl.searchParams.get("slots") ?? "").split(",").map((value) => value.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}\|\d{2}:\d{2}$/.test(value));
  if (!fecha && !blockId && !blockIds.length && !slotValues.length) return NextResponse.json({ error: "Indicá la fecha, el bloque o los turnos que querés cancelar." }, { status: 400 });

  const supabase = createAdminSupabase();
  const doctor = await supabase.from("doctors").select("id").eq("user_id", session!.user!.id).single();
  if (doctor.error) return NextResponse.json({ error: "No se encontró el perfil médico." }, { status: 404 });

  if (slotValues.length) {
    const bookedSlots = await supabase.from("turnos").select("fecha_preferida, hora_preferida").eq("doctor_id", doctor.data.id).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]);
    if (bookedSlots.error) return NextResponse.json({ error: bookedSlots.error.message }, { status: 500 });
    const bookedKeys = new Set((bookedSlots.data ?? []).map((row) => `${row.fecha_preferida}|${String(row.hora_preferida).slice(0, 5)}`));
    const reservedSelection = slotValues.find((value) => bookedKeys.has(value));
    if (reservedSelection) return NextResponse.json({ error: `No se puede cancelar ${reservedSelection.replace("|", " ")} porque ya tiene un turno reservado.` }, { status: 409 });
    const exclusions = slotValues.map((value) => { const [slotDate, slotTime] = value.split("|"); return { doctor_id: doctor.data.id, fecha: slotDate, hora: slotTime }; });
    const result = await supabase.from("doctor_disponibilidad_exclusiones").upsert(exclusions, { onConflict: "doctor_id,fecha,hora" });
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, slots: slotValues });
  }

  const idsToDelete = blockIds.length ? blockIds : blockId ? [blockId] : [];
  if (idsToDelete.length) {
    const blocks = await supabase.from("doctor_disponibilidades").select("id, fecha, hora_inicio, hora_fin").eq("doctor_id", doctor.data.id).in("id", idsToDelete);
    if (blocks.error) return NextResponse.json({ error: blocks.error.message }, { status: 500 });
    if ((blocks.data ?? []).length !== idsToDelete.length) return NextResponse.json({ error: "Uno de los bloques seleccionados ya no existe." }, { status: 404 });
    for (const block of blocks.data ?? []) {
      const occupiedBlock = await supabase.from("turnos").select("id").eq("doctor_id", doctor.data.id).eq("fecha_preferida", block.fecha).gte("hora_preferida", block.hora_inicio).lt("hora_preferida", block.hora_fin).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]).limit(1);
      if (occupiedBlock.error) return NextResponse.json({ error: occupiedBlock.error.message }, { status: 500 });
      if (occupiedBlock.data?.length) return NextResponse.json({ error: `No se puede cancelar el bloque de ${String(block.hora_inicio).slice(0, 5)} a ${String(block.hora_fin).slice(0, 5)} porque tiene turnos reservados.` }, { status: 409 });
    }
    const blockResult = await supabase.from("doctor_disponibilidades").delete().eq("doctor_id", doctor.data.id).in("id", idsToDelete);
    if (blockResult.error) return NextResponse.json({ error: blockResult.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ids: idsToDelete });
  }

  const occupied = await supabase.from("turnos").select("id").eq("doctor_id", doctor.data.id).eq("fecha_preferida", fecha).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]).limit(1);
  if (occupied.error) return NextResponse.json({ error: occupied.error.message }, { status: 500 });
  if (occupied.data?.length) return NextResponse.json({ error: "No se puede eliminar este día porque ya tiene turnos reservados." }, { status: 409 });

  const result = await supabase.from("doctor_disponibilidades").delete().eq("doctor_id", doctor.data.id).eq("fecha", fecha);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, fecha });
}
