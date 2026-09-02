import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

export type TeleconsultaRole = "doctor" | "patient";
export type TeleconsultaAccessState = "active" | "too_early" | "finished" | "unavailable" | "forbidden";

export type TeleconsultaTurno = {
  id: string;
  paciente_id: string | null;
  paciente_user_id: string | null;
  doctor_id: string | null;
  nombre: string;
  email: string;
  telefono: string;
  motivo: string;
  fecha_preferida: string;
  hora_preferida: string;
  obra_social: string | null;
  estado: string;
  tipo_consulta: string | null;
  duracion_minutos: number | null;
  meet_link: string | null;
  fecha_hora_inicio_real: string | null;
  fecha_hora_fin_real: string | null;
};

export type AuthorizedTeleconsulta = {
  state: TeleconsultaAccessState;
  turno: TeleconsultaTurno | null;
  doctor: { id: string; nombre: string | null; especialidad: string | null; documento: string | null } | null;
};

function scheduledStart(fecha: string, hora: string) {
  const normalizedTime = hora.length === 5 ? `${hora}:00` : hora;
  return new Date(`${fecha}T${normalizedTime}-03:00`);
}

type TeleconsultaSchedule = Pick<
  TeleconsultaTurno,
  "estado" | "tipo_consulta" | "fecha_preferida" | "hora_preferida" | "duracion_minutos" | "fecha_hora_fin_real"
>;

export function getTeleconsultaAccessState(turno: TeleconsultaSchedule, now = new Date()): TeleconsultaAccessState {
  // en_consulta sólo se acepta para recuperar turnos que se guardaron con el flujo anterior.
  if ((turno.estado !== "confirmado" && turno.estado !== "en_consulta") || turno.tipo_consulta !== "videoconsulta") return "unavailable";

  const start = scheduledStart(turno.fecha_preferida, turno.hora_preferida);
  if (Number.isNaN(start.getTime())) return "unavailable";

  const earlyAccess = new Date(start.getTime() - 10 * 60 * 1000);
  const duration = Math.max(1, turno.duracion_minutos ?? 30);
  const scheduledEnd = new Date(start.getTime() + duration * 60 * 1000);
  if (now < earlyAccess) return "too_early";
  if (now > scheduledEnd || turno.fecha_hora_fin_real) return "finished";
  return "active";
}

export function validMeetLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "meet.google.com" || url.hostname.endsWith(".meet.google.com"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// Esta función se usa en páginas y rutas para que la autorización no dependa de la UI.
export async function getAuthorizedTeleconsulta(turnoId: string, role: TeleconsultaRole): Promise<AuthorizedTeleconsulta> {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== role) return { state: "forbidden", turno: null, doctor: null };

  const supabase = createAdminSupabase();
  const turnoResult = await supabase
    .from("turnos")
    .select("id, paciente_id, paciente_user_id, doctor_id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, obra_social, estado, tipo_consulta, duracion_minutos, meet_link, fecha_hora_inicio_real, fecha_hora_fin_real")
    .eq("id", turnoId)
    .maybeSingle();
  if (turnoResult.error || !turnoResult.data) return { state: "forbidden", turno: null, doctor: null };

  const turno = turnoResult.data as TeleconsultaTurno;
  let doctor: AuthorizedTeleconsulta["doctor"] = null;
  if (role === "doctor") {
    const doctorResult = await supabase.from("doctors").select("id, nombre, especialidad, documento").eq("user_id", user.id).maybeSingle();
    if (!doctorResult.data || doctorResult.data.id !== turno.doctor_id) return { state: "forbidden", turno: null, doctor: null };
    doctor = doctorResult.data;
  } else {
    if (turno.paciente_user_id !== user.id) return { state: "forbidden", turno: null, doctor: null };
    const doctorResult = await supabase.from("doctors").select("id, nombre, especialidad, documento").eq("id", turno.doctor_id ?? "").maybeSingle();
    doctor = doctorResult.data;
  }

  return { state: getTeleconsultaAccessState(turno), turno, doctor };
}