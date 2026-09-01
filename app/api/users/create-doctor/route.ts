import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase-server";
import { POST as applyPendingCookies } from "@/app/api/supabase/apply-cookies/route";

export async function POST() {
  try {
    const supabaseServer = await createServerSupabase();
    const { data: { session } } = await supabaseServer.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const role = session.user.user_metadata?.role as string | undefined;
    if (role !== "doctor") {
      return NextResponse.json({ error: "El usuario no tiene rol de doctor." }, { status: 403 });
    }

    const admin = createAdminSupabase();

    const metadata = session.user.user_metadata ?? {};
    const nombre =
      metadata.full_name ||
      [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") ||
      null;

    const upsertResult = await admin
      .from("doctors")
      .upsert(
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

    if (upsertResult.error) {
      return NextResponse.json({ error: upsertResult.error.message }, { status: 500 });
    }

    // Try to apply any pending cookies collected by createServerSupabase()
    try {
      await applyPendingCookies();
    } catch (e) {
      // ignore cookie application errors
    }

    return NextResponse.json({ ok: true, doctor: upsertResult.data?.[0] ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}
