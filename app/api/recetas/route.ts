import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabaseServer = await createServerSupabase();
  const {
    data: { session },
  } = await supabaseServer.auth.getSession();

  if (!session?.user || session.user.user_metadata?.role !== "doctor") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 401 });
  }

  const body = await request.json();
  const pacienteId = body.paciente_id?.toString().trim();
  const consultaId = body.consulta_id?.toString().trim() || null;
  const fechaEmision = body.fecha_emision?.toString().trim() || new Date().toISOString().slice(0, 10);
  const pdfUrl = body.pdf_url?.toString().trim() || null;
  const medicaciones = Array.isArray(body.medicaciones) ? body.medicaciones : [];

  if (!pacienteId) {
    return NextResponse.json({ error: "Paciente es obligatorio." }, { status: 400 });
  }

  const supabase = createAdminSupabase();
  const insertResult = await supabase
    .from("recetas")
    .insert([
      {
        paciente_id: pacienteId,
        consulta_id: consultaId,
        fecha_emision: fechaEmision,
        pdf_url: pdfUrl,
      },
    ])
    .select()
    .maybeSingle();

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  if (insertResult.data?.id && medicaciones.length > 0) {
    const recetaItems = medicaciones
      .map((item: Record<string, unknown>) => ({
        receta_id: insertResult.data?.id,
        nombre_medicamento: item?.nombre_medicamento?.toString().trim() ?? "",
        dosis: item?.dosis?.toString().trim() || null,
        frecuencia: item?.frecuencia?.toString().trim() || null,
        instrucciones: item?.instrucciones?.toString().trim() || null,
      }))
      .filter((item: { nombre_medicamento: string }) => item.nombre_medicamento);

    if (recetaItems.length > 0) {
      const recetaItemsResult = await supabase.from("receta_medicaciones").insert(recetaItems);
      if (recetaItemsResult.error) {
        return NextResponse.json({ error: recetaItemsResult.error.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, receta: insertResult.data }, { status: 201 });
}
