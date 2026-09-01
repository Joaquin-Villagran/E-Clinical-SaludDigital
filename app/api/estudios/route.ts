import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

async function ensureDoctorRole() {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  return session?.user && session.user.user_metadata?.role === "doctor";
}

export async function POST(request: NextRequest) {
  try {
    if (!(await ensureDoctorRole())) {
      return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let pacienteId = "";
    let pacienteEmail = "";
    let consultaId = "";
    let titulo = "";
    let categoria = "";
    let fecha = "";
    let hora = "";
    let archivoUrl = "";
    let externalUrl = "";
    let esDescargable = false;
    let turnoId = "";
    let file: File | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      pacienteId = body.paciente_id?.toString().trim() ?? "";
      pacienteEmail = body.paciente_email?.toString().trim() ?? "";
      consultaId = body.consulta_id?.toString().trim() ?? "";
      titulo = body.titulo?.toString().trim() ?? "";
      categoria = body.categoria?.toString().trim() ?? "";
      fecha = body.fecha?.toString() ?? "";
      hora = body.hora?.toString() ?? "";
      archivoUrl = body.archivo_url?.toString().trim() ?? body.file_url?.toString().trim() ?? "";
      externalUrl = body.external_url?.toString().trim() ?? "";
      esDescargable = Boolean(body.es_descargable);
      turnoId = body.turno_id?.toString().trim() ?? "";
    } else {
      const formData = await request.formData();
      pacienteId = formData.get("paciente_id")?.toString().trim() ?? "";
      pacienteEmail = formData.get("paciente_email")?.toString().trim() ?? "";
      consultaId = formData.get("consulta_id")?.toString().trim() ?? "";
      titulo = formData.get("titulo")?.toString().trim() ?? "";
      categoria = formData.get("categoria")?.toString().trim() ?? "";
      fecha = formData.get("fecha")?.toString() ?? "";
      hora = formData.get("hora")?.toString() ?? "";
      archivoUrl = formData.get("archivo_url")?.toString().trim() ?? formData.get("file_url")?.toString().trim() ?? "";
      externalUrl = formData.get("external_url")?.toString().trim() ?? "";
      esDescargable = formData.get("es_descargable")?.toString() === "true";
      turnoId = formData.get("turno_id")?.toString().trim() ?? "";
      file = formData.get("file") as File | null;
    }

    if ((!pacienteId && !pacienteEmail) || !titulo || !categoria || !fecha) {
      return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
    }

    const categoriasValidas = ["laboratorio", "imagen", "cardiologia", "otro"];
    if (!categoriasValidas.includes(categoria)) {
      categoria = "otro";
    }

    const supabase = createAdminSupabase();

    if (file) {
      if (file.size < 10 * 1024 * 1024) {
        return NextResponse.json({ error: "El archivo debe ser mayor o igual a 10 MB." }, { status: 400 });
      }

      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;
      const path = `estudios/${safeName}`;
      const uploadResult = await supabase.storage.from("estudios").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

      if (uploadResult.error) {
        return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
      }

      const publicUrlResult = supabase.storage.from("estudios").getPublicUrl(path);
      archivoUrl = publicUrlResult.data.publicUrl;
      esDescargable = true;
    }

    if (!archivoUrl && externalUrl) {
      archivoUrl = externalUrl;
    }

    if (!pacienteId && pacienteEmail) {
      const patientLookup = await supabase.from("pacientes").select("id").eq("email", pacienteEmail).maybeSingle();
      if (patientLookup.error) {
        return NextResponse.json({ error: patientLookup.error.message }, { status: 500 });
      }
      if (!patientLookup.data?.id) {
        return NextResponse.json({ error: "No se encontro un paciente con ese email." }, { status: 400 });
      }
      pacienteId = patientLookup.data.id;
    }

    if (!pacienteEmail && pacienteId) {
      const patientEmailLookup = await supabase.from("pacientes").select("email").eq("id", pacienteId).maybeSingle();
      if (!patientEmailLookup.error) {
        pacienteEmail = patientEmailLookup.data?.email?.toString().trim() ?? "";
      }
    }

    let insertResult = await supabase
      .from("estudios")
      .insert([
        {
          paciente_id: pacienteId,
          consulta_id: consultaId || null,
          titulo,
          categoria,
          fecha,
          archivo_url: archivoUrl || null,
          es_descargable: esDescargable || Boolean(archivoUrl),
        },
      ])
      .select()
      .maybeSingle();

    if (insertResult.error) {
      // Fallback para esquema legacy: conserva compatibilidad si aun no migraste la tabla.
      insertResult = await supabase
        .from("estudios")
        .insert([
          {
            paciente_email: pacienteEmail,
            titulo,
            categoria,
            fecha,
            hora: hora || "00:00",
            file_url: archivoUrl || null,
            external_url: externalUrl || null,
          },
        ])
        .select()
        .maybeSingle();
    }

    if (insertResult.error) {
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
    }

    if (turnoId) {
      const turnoUpdate = await supabase.from("turnos").update({ estado: "finalizado" }).eq("id", turnoId);
      if (turnoUpdate.error) {
        console.error("Error finalizando turno tras subir estudio:", turnoUpdate.error.message);
      }
    }

    return NextResponse.json({ ok: true, estudio: insertResult.data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ocurrió un error al procesar la solicitud.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
