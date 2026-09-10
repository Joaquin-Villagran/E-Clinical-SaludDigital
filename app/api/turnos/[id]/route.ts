import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Resend } from "resend";

type DoctorTurnoMetadata = Record<string, unknown>;
type NotificationTurno = {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  motivo: string | null;
  fecha_preferida: string | null;
  hora_preferida: string | null;
  obra_social: string | null;
};

type DoctorTurnoAction = "confirmar" | "rechazar" | "cancelar" | "en_espera" | "iniciar_consulta" | "finalizar" | "no_asistio" | "reprogramar" | "configurar_consulta";
type PatientTurnoAction = "cancelar_paciente" | "reprogramar_paciente";

const allowedActions: DoctorTurnoAction[] = ["confirmar", "rechazar", "cancelar", "en_espera", "iniciar_consulta", "finalizar", "no_asistio", "reprogramar", "configurar_consulta"];

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  return `+${cleaned}`;
}

async function sendConfirmationEmail(turno: NotificationTurno) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail || !turno.email) return;

  const resend = new Resend(apiKey);
  const subject = `Turno confirmado: ${turno.fecha_preferida || ""} ${turno.hora_preferida || ""}`;
  const text = `Hola ${turno.nombre || ""},\n\nTu turno ha sido confirmado.\n\nDetalles del turno:\n- Fecha: ${turno.fecha_preferida || ""}\n- Hora: ${turno.hora_preferida || ""}\n- Motivo: ${turno.motivo || ""}\n- Obra social: ${turno.obra_social || "No informada"}\n\nGracias por elegirnos.`;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: turno.email,
      subject,
      text,
    });
  } catch (error) {
    console.error("Error enviando email de confirmación:", error);
  }
}

async function sendWhatsappConfirmation(turno: NotificationTurno) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM;
  const phone = normalizePhone(turno.telefono || "");
  if (!accountSid || !authToken || !fromWhatsApp || !phone) return;

  const body = `Hola ${turno.nombre || ""}, tu turno ha sido confirmado para ${turno.fecha_preferida || ""} a las ${turno.hora_preferida || ""}. Gracias.`;
  const params = new URLSearchParams({
    To: `whatsapp:${phone}`,
    From: fromWhatsApp,
    Body: body,
  });

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error enviando WhatsApp de confirmación:", errorText);
    }
  } catch (error) {
    console.error("Error enviando WhatsApp de confirmación:", error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabaseServer = await createServerSupabase();
    const { data: { session } } = await supabaseServer.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
    }

    const body = await request.json();
    const { action, fecha_preferida: fechaPreferida, hora_preferida: horaPreferida, tipo_consulta: tipoConsulta, meet_link: meetLink } = body as {
      action?: DoctorTurnoAction | PatientTurnoAction;
      fecha_preferida?: string;
      hora_preferida?: string;
      tipo_consulta?: string;
      meet_link?: string;
    };
    const params = await context.params;
    const turnoId = params.id;

    if (!action || (!allowedActions.includes(action as DoctorTurnoAction) && action !== "cancelar_paciente" && action !== "reprogramar_paciente")) {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    const turnoResult = await supabase
      .from("turnos")
      .select("id, paciente_id, paciente_user_id, doctor_id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, obra_social, estado, tipo_consulta, meet_link, metadata")
      .eq("id", turnoId)
      .single();
    if (turnoResult.error) {
      return NextResponse.json({ error: turnoResult.error.message }, { status: 500 });
    }

    const turno = turnoResult.data;
    const rawMetadata = turno?.metadata;
    const metadata: DoctorTurnoMetadata =
      rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata) ? rawMetadata : {};
    if (action === "cancelar_paciente" || action === "reprogramar_paciente") {
      const isOwner = turno.paciente_user_id === session.user.id || turno.email === session.user.email;
      if (session.user.user_metadata?.role === "doctor" || !isOwner) {
        return NextResponse.json({ error: "No podés modificar este turno." }, { status: 403 });
      }
      if (!["pendiente", "confirmado", "en_espera"].includes(turno.estado)) {
        return NextResponse.json({ error: "Este turno ya no se puede modificar." }, { status: 409 });
      }
      if (action === "cancelar_paciente") {
        const result = await supabase.from("turnos").update({ estado: "cancelado", metadata: { ...metadata, cancelado_por: "paciente", cancelado_at: new Date().toISOString() } }).eq("id", turnoId);
        if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
        return NextResponse.json({ ok: true, estado: "cancelado" });
      }
      if (!fechaPreferida || !horaPreferida || !turno.doctor_id) {
        return NextResponse.json({ error: "Seleccioná una nueva fecha y horario." }, { status: 400 });
      }
      const availability = await supabase.from("doctor_disponibilidades").select("hora_inicio, hora_fin, intervalo_minutos").eq("doctor_id", turno.doctor_id).eq("fecha", fechaPreferida).eq("activo", true);
      const [requestedHour, requestedMinute] = horaPreferida.slice(0, 5).split(":").map(Number);
      const requestedMinutes = requestedHour * 60 + requestedMinute;
      const isPublishedSlot = (availability.data ?? []).some((block) => {
        const [startHour, startMinute] = String(block.hora_inicio).slice(0, 5).split(":").map(Number);
        const [endHour, endMinute] = String(block.hora_fin).slice(0, 5).split(":").map(Number);
        const startMinutes = startHour * 60 + startMinute;
        return requestedMinutes >= startMinutes && requestedMinutes < endHour * 60 + endMinute && (requestedMinutes - startMinutes) % block.intervalo_minutos === 0;
      });
      if (availability.error || !isPublishedSlot) return NextResponse.json({ error: "El horario elegido no está disponible." }, { status: 409 });
      const occupied = await supabase.from("turnos").select("id").eq("doctor_id", turno.doctor_id).eq("fecha_preferida", fechaPreferida).eq("hora_preferida", horaPreferida).neq("id", turnoId).in("estado", ["pendiente", "confirmado", "en_espera", "en_consulta"]).maybeSingle();
      if (occupied.error) return NextResponse.json({ error: occupied.error.message }, { status: 500 });
      if (occupied.data) return NextResponse.json({ error: "Ese horario acaba de ser ocupado." }, { status: 409 });
      const result = await supabase.from("turnos").update({ fecha_preferida: fechaPreferida, hora_preferida: horaPreferida, estado: "pendiente", metadata: { ...metadata, reprogramado_por: "paciente", reprogramado_at: new Date().toISOString() } }).eq("id", turnoId);
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, estado: "pendiente", fecha_preferida: fechaPreferida, hora_preferida: horaPreferida });
    }
    if (session.user.user_metadata?.role !== "doctor") {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
    }
    const doctorResult = await supabase.from("doctors").select("id").eq("user_id", session.user.id).maybeSingle();
    if (!doctorResult.data) {
      return NextResponse.json({ error: "No se encontró el perfil profesional." }, { status: 403 });
    }
    if (turno.doctor_id && turno.doctor_id !== doctorResult.data.id) {
      return NextResponse.json({ error: "Este turno está asignado a otro profesional." }, { status: 403 });
    }
    const now = new Date().toISOString();

    const metadataUpdates: DoctorTurnoMetadata = {
      ...metadata,
      doctor_last_action: action,
      doctor_last_action_at: now,
    };

    const updates: Record<string, unknown> = {
      metadata: metadataUpdates,
    };

    if (action === "confirmar") {
      updates.estado = "confirmado";
      updates.doctor_id = doctorResult.data.id;
      if (tipoConsulta === "presencial" || tipoConsulta === "videoconsulta") {
        updates.tipo_consulta = tipoConsulta;
        metadataUpdates.modalidad_atencion = tipoConsulta;
      }
      updates.meet_link = null;
    } else if (action === "rechazar") {
      updates.estado = "rechazado";
    } else if (action === "cancelar") {
      updates.estado = "cancelado";
    } else if (action === "en_espera") {
      updates.estado = "en_espera";
    } else if (action === "iniciar_consulta") {
      // La sesión conserva el turno confirmado: ese es el requisito de acceso de la sala protegida.
      updates.estado = "confirmado";
    } else if (action === "finalizar") {
      updates.estado = "finalizado";
    } else if (action === "no_asistio") {
      updates.estado = "no_asistio";
    } else if (action === "reprogramar") {
      if (!fechaPreferida || !horaPreferida) {
        return NextResponse.json({ error: "Indicá nueva fecha y hora para reprogramar." }, { status: 400 });
      }
      updates.fecha_preferida = fechaPreferida;
      updates.hora_preferida = horaPreferida;
      updates.estado = "pendiente";
      updates.doctor_id = doctorResult.data.id;
    } else if (action === "configurar_consulta") {
      if (turno.estado !== "confirmado") {
        return NextResponse.json({ error: "Sólo se puede configurar un turno confirmado." }, { status: 409 });
      }
      if (tipoConsulta !== "presencial" && tipoConsulta !== "videoconsulta") {
        return NextResponse.json({ error: "Seleccioná la modalidad de consulta." }, { status: 400 });
      }
      updates.tipo_consulta = tipoConsulta;
      updates.meet_link = null;
      metadataUpdates.modalidad_atencion = tipoConsulta;
      updates.doctor_id = doctorResult.data.id;
    }

    const updateResult = await supabase.from("turnos").update(updates).eq("id", turnoId);
    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    if (action === "confirmar" && turno) {
      await Promise.allSettled([sendConfirmationEmail(turno), sendWhatsappConfirmation(turno)]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
