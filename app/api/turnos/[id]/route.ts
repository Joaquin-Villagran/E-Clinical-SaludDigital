import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { Resend } from "resend";

type DoctorTurnoMetadata = Record<string, unknown>;

type DoctorTurnoAction = "confirmar" | "cancelar" | "preguntar" | "finalizar";

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^0-9+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  return `+${cleaned}`;
}

async function sendConfirmationEmail(turno: any) {
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

async function sendWhatsappConfirmation(turno: any) {
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

    if (!session?.user || session.user.user_metadata?.role !== "doctor") {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body as { action?: string };
    const params = await context.params;
    const turnoId = params.id;

    if (!action || !["confirmar", "cancelar", "preguntar", "finalizar"].includes(action)) {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    const turnoResult = await supabase
      .from("turnos")
      .select("id, nombre, email, telefono, motivo, fecha_preferida, hora_preferida, obra_social, metadata")
      .eq("id", turnoId)
      .single();
    if (turnoResult.error) {
      return NextResponse.json({ error: turnoResult.error.message }, { status: 500 });
    }

    const turno = turnoResult.data;
    const rawMetadata = turno?.metadata;
    const metadata: DoctorTurnoMetadata =
      rawMetadata && typeof rawMetadata === "object" && !Array.isArray(rawMetadata) ? rawMetadata : {};
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
    } else if (action === "cancelar") {
      updates.estado = "cancelado";
    } else if (action === "preguntar") {
      // mantener compatibilidad si se usa desde otro lugar
      updates.estado = "pendiente";
    } else if (action === "finalizar") {
      updates.estado = "finalizado";
    }

    const updateResult = await supabase.from("turnos").update(updates).eq("id", turnoId);
    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 });
    }

    if (action === "confirmar" && turno) {
      await Promise.allSettled([sendConfirmationEmail(turno), sendWhatsappConfirmation(turno)]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
