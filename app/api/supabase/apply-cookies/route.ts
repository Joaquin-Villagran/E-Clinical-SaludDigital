import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createServerSupabase();
  const pending = (supabase as any)._pendingCookies as Array<{ name: string; value: string; options?: any }> | undefined;
  const cookieStore = cookies();

  if (Array.isArray(pending) && pending.length) {
    for (const { name, value, options } of pending) {
      try {
        cookieStore.set(name, value, options ?? {});
      } catch (e) {
        // ignore individual cookie set failures
      }
    }
  }

  return NextResponse.json({ applied: pending?.length ?? 0 });
}
