"use client";

import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

// Support both NEXT_PUBLIC_* names and legacy SUPABASE_* names from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

// Avoid throwing during module import on client; provide a helpful proxy if vars are missing.
// Export must be top-level; create variable and export it after assignment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any;

if (!supabaseUrl || !supabaseAnonKey) {
  const missingMessage =
    "Missing client Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local for client-side usage.";

  _supabase = new Proxy(
    {},
    {
      get() {
        throw new Error(missingMessage);
      },
    }
  );
} else {
  _supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
    },
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });
}

export const supabase = _supabase;
