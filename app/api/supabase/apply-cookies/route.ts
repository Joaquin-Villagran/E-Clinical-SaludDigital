import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createServerSupabase();
  const pending = (supabase as unknown as { _pendingCookies?: Array<{ name: string; value: string; options?: Record<string, unknown> }> })._pendingCookies;
  const cookieStore = await cookies();

  if (Array.isArray(pending) && pending.length) {
    for (const { name, value, options } of pending) {
      try {
        cookieStore.set(name, value, options ?? {});
      } catch {
        // ignore individual cookie set failures
      }
    }
  }

  return NextResponse.json({ applied: pending?.length ?? 0 });
}
