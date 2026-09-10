import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";
import { isTurnoFinalizado } from "@/lib/teleconsulta";

type Context = { params: Promise<{ id: string }> };
type ClosureBody = {
  action?: "feedback" | "accept_interconsulta" | "defer_interconsulta" | "suggest_interconsulta";
  calificacion?: number;
  resolvio_motivo?: "si" | "parcialmente" | "no";
  comentario?: string;
  especialidad_destino?: string;
  profesional_destino_id?: string | null;
};

async function getClosureContext(context: Context) {
  const user = await getServerUser();
  const role = user?.user_metadata?.role;
  if (!user || (role !== "doctor" && role !== "patient")) return { response: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  const { id } = await context.params;
  const supabase = createAdminSupabase();
  const turnoResult = await supabase.from("turnos").select("id, paciente_id, paciente_user_id, email, doctor_id, nombre, fecha_preferida, hora_preferida, estado, tipo_consulta, fecha_hora_inicio_real, fecha_hora_fin_real, video_status").eq("id", id).maybeSingle();
  if (turnoResult.error) return { response: NextResponse.json({ error: turnoResult.error.message }, { status: 500 }) };
  const turno = turnoResult.data;
  if (!turno || turno.tipo_consulta !== "videoconsulta") return { response: NextResponse.json({ error: "La consulta no es una videoconsulta." }, { status: 409 }) };
  const isPatient = role === "patient" && (turno.paciente_user_id === user.id || turno.email?.toLowerCase() === user.email?.toLowerCase());
  let isDoctor = false;
  if (role === "doctor") {
    const doctor = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
    isDoctor = Boolean(doctor.data && doctor.data.id === turno.doctor_id);
  }
  if (!isPatient && !isDoctor) return { response: NextResponse.json({ error: "No tenés acceso a este cierre." }, { status: 403 }) };
  if (!isTurnoFinalizado(turno)) {
    const shouldAllowClosure = role === "patient" && (turno.video_status === "completed" || turno.estado === "en_consulta");
    if (!shouldAllowClosure) {
      return { response: NextResponse.json({ error: "La consulta todavía no está finalizada." }, { status: 409 }) };
    }
  }
  const consultaCandidates = await supabase.from("consultas").select("id, paciente_id, profesional_id, turno_id, metadata, fecha, motivo_consulta, observaciones").limit(200);
  if (consultaCandidates.error) return { response: NextResponse.json({ error: consultaCandidates.error.message }, { status: 500 }) };
  const consultaData = (consultaCandidates.data ?? []).find((consulta) => {
    const metadata = consulta.metadata && typeof consulta.metadata === "object" && !Array.isArray(consulta.metadata) ? consulta.metadata as Record<string, unknown> : {};
    return consulta.turno_id === id || String(metadata.turno_id ?? "") === id;
  });
  if (!consultaData) return { response: NextResponse.json({ error: "La consulta clínica todavía no está vinculada al turno." }, { status: 409 }) };
  return { user, role, isPatient, isDoctor, turno, consulta: consultaData, supabase };
}

function durationMinutes(start: string | null, end: string | null) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export async function GET(_request: NextRequest, context: Context) {
  const access = await getClosureContext(context);
  if ("response" in access) return access.response;
  const { data: feedback } = await access.supabase.from("teleconsulta_feedback").select("id, calificacion, resolvio_motivo, comentario, fecha_creacion").eq("consulta_id", access.consulta.id).maybeSingle();
  const { data: interconsulta } = await access.supabase.from("teleconsulta_interconsultas").select("id, especialidad_destino, profesional_destino_id, aceptada, turno_generado, sugerida, fecha").eq("consulta_id", access.consulta.id).maybeSingle();
  let profesionalDestino = null;
  if (interconsulta?.profesional_destino_id) {
    const result = await access.supabase.from("doctors").select("id, nombre, especialidad, matricula, foto_url").eq("id", interconsulta.profesional_destino_id).maybeSingle();
    profesionalDestino = result.data;
  }
  const doctor = access.turno.doctor_id ? (await access.supabase.from("doctors").select("id, nombre, especialidad, matricula").eq("id", access.turno.doctor_id).maybeSingle()).data : null;
  const nextTurnResult = await access.supabase.from("turnos").select("id, fecha_preferida, hora_preferida, estado").eq("paciente_id", access.consulta.paciente_id).gte("fecha_preferida", new Date().toISOString().slice(0, 10)).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]).neq("id", access.turno.id).order("fecha_preferida", { ascending: true }).order("hora_preferida", { ascending: true }).limit(1).maybeSingle();
  return NextResponse.json({
    turno: { id: access.turno.id, fecha: access.turno.fecha_preferida, hora: access.turno.hora_preferida, duracion_minutos: durationMinutes(access.turno.fecha_hora_inicio_real, access.turno.fecha_hora_fin_real) },
    consulta: { id: access.consulta.id, paciente_id: access.consulta.paciente_id, profesional_id: access.consulta.profesional_id },
    doctor,
    proximo_turno: nextTurnResult.data,
    feedback,
    interconsulta: interconsulta ? { ...interconsulta, profesional: profesionalDestino } : null,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const access = await getClosureContext(context);
  if ("response" in access) return access.response;
  let body: ClosureBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 }); }

  if (body.action === "feedback") {
    if (!access.isPatient) return NextResponse.json({ error: "Sólo el paciente puede registrar la evaluación." }, { status: 403 });
    if (![1, 2, 3].includes(body.calificacion ?? 0) || !["si", "parcialmente", "no"].includes(body.resolvio_motivo ?? "")) return NextResponse.json({ error: "Completá la calificación y si se resolvió el motivo." }, { status: 400 });
    const existing = await access.supabase.from("teleconsulta_feedback").select("id").eq("consulta_id", access.consulta.id).maybeSingle();
    if (existing.data) return NextResponse.json({ error: "La evaluación ya fue registrada." }, { status: 409 });
    const medicoId = access.consulta.profesional_id ?? access.turno.doctor_id;
    if (!medicoId) return NextResponse.json({ error: "La consulta no tiene un profesional vinculado." }, { status: 409 });
    const result = await access.supabase.from("teleconsulta_feedback").insert({ consulta_id: access.consulta.id, turno_id: access.turno.id, paciente_id: access.consulta.paciente_id, medico_id: medicoId, calificacion: body.calificacion, resolvio_motivo: body.resolvio_motivo, comentario: body.comentario?.trim() || null }).select().single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, feedback: result.data });
  }

  if (body.action === "suggest_interconsulta") {
    if (!access.isDoctor) return NextResponse.json({ error: "Sólo el profesional puede sugerir una interconsulta." }, { status: 403 });
    if (!body.especialidad_destino?.trim()) return NextResponse.json({ error: "Indicá la especialidad sugerida." }, { status: 400 });
    const existing = await access.supabase.from("teleconsulta_interconsultas").select("id").eq("consulta_id", access.consulta.id).maybeSingle();
    if (existing.data) return NextResponse.json({ error: "La interconsulta ya fue registrada." }, { status: 409 });
    const medicoId = access.consulta.profesional_id ?? access.turno.doctor_id;
    if (!medicoId) return NextResponse.json({ error: "La consulta no tiene un profesional vinculado." }, { status: 409 });
    const result = await access.supabase.from("teleconsulta_interconsultas").insert({ consulta_id: access.consulta.id, turno_id: access.turno.id, paciente_id: access.consulta.paciente_id, medico_origen_id: medicoId, especialidad_destino: body.especialidad_destino.trim(), profesional_destino_id: body.profesional_destino_id || null }).select().single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, interconsulta: result.data });
  }

  if (body.action === "accept_interconsulta" || body.action === "defer_interconsulta") {
    if (!access.isPatient) return NextResponse.json({ error: "Sólo el paciente puede responder la sugerencia." }, { status: 403 });
    const result = await access.supabase.from("teleconsulta_interconsultas").update({ aceptada: body.action === "accept_interconsulta" }).eq("consulta_id", access.consulta.id).eq("paciente_id", access.consulta.paciente_id).select().maybeSingle();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, aceptada: body.action === "accept_interconsulta" });
  }

  return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
}
