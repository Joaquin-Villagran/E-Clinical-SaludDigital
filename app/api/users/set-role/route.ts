import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { role } = body as { role?: string };

    if (!role || !["doctor", "patient"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
    }

    const supabaseServer = await createServerSupabase();
    const { data: { session } } = await supabaseServer.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const admin = createAdminSupabase();

    // Update user metadata via admin API
    // @ts-ignore - using admin auth
    const updateResult = await admin.auth.admin.updateUserById(session.user.id, {
      user_metadata: {
        ...(session.user.user_metadata ?? {}),
        role,
      },
    });

    if ((updateResult as any).error) {
      return NextResponse.json({ error: (updateResult as any).error.message }, { status: 500 });
    }

    // If role is doctor, ensure doctors row exists and persist professional details
    if (role === "doctor") {
      const metadata = session.user.user_metadata ?? {};
      const nombre =
        metadata.full_name ||
        [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") ||
        null;
      const upsert = await admin.from("doctors").upsert(
        {
          user_id: session.user.id,
          nombre,
          profesion: metadata.profesion ?? null,
          especialidad: metadata.especialidad ?? null,
          telefono: metadata.telefono ?? null,
          documento: metadata.documento ?? null,
          sexo: metadata.sexo ?? null,
          estado_civil: metadata.estado_civil ?? null,
          obra_social: metadata.obra_social ?? null,
          metadata: metadata as Record<string, unknown> | null,
        },
        { onConflict: "user_id" }
      );
      if (upsert.error) {
        return NextResponse.json({ error: upsert.error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}
