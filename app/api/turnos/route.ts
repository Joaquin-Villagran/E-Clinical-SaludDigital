import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabaseServer = await createServerSupabase();
    const {
      data: { session },
    } = await supabaseServer.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Sesión requerida para solicitar un turno." }, { status: 401 });
    }

    const body = await request.json();
    const { motivo, fecha_preferida, hora_preferida, obra_social, es_particular, especialidad } = body;
    const user = session.user;
    const metadata = user.user_metadata ?? {};
    const nombre = metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || user.email || "";
    const email = user.email || "";
    const telefono = metadata.telefono || metadata.phone || "";
    const obraSocial = metadata.obra_social ?? obra_social ?? null;

    if (!nombre || !email || !telefono || !motivo || !fecha_preferida || !hora_preferida || !especialidad) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const supabase = createAdminSupabase();

    const { error } = await supabase.from("turnos").insert([
      {
        paciente_user_id: user.id,
        nombre,
        email,
        telefono,
        motivo,
        fecha_preferida,
        hora_preferida,
        obra_social: obraSocial,
        es_particular: Boolean(es_particular),
        estado: "pendiente",
        recordatorio_enviado: false,
        metadata: { especialidad },
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
