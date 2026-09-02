import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Server component client for auth-aware pages (uses cookies)
export async function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables for server client. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY)."
    );
  }

  // pass a cookie helper compatible with Supabase's server client expectations
  const cookieStore = (await cookies()) as any;

  // collect pending cookies when they cannot be written in this context
  const pendingCookies: Array<{ name: string; value: string; options?: any }> = [];

  const cookieMethods = {
    getAll: async () => {
      const cookieList = await cookieStore.getAll?.();
      return (cookieList ?? []).map((cookie: any) => ({ name: cookie.name, value: cookie.value ?? "" }));
    },
    setAll: async (setCookies: Array<{ name: string; value: string; options?: any }>) => {
      for (const { name, value, options } of setCookies) {
        try {
          if (typeof cookieStore.set === "function") {
            cookieStore.set(name, value, options);
          } else {
            // store to pending so a Route Handler / Server Action can apply them
            pendingCookies.push({ name, value, options });
          }
        } catch (e) {
          // On errors, also collect as pending so the caller can handle them
          pendingCookies.push({ name, value, options });
        }
      }
    },
  };

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: cookieMethods,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  });

  // expose pending cookies for the caller (Route Handler / Server Action can read and apply them)
  (supabase as any)._pendingCookies = pendingCookies;

  return supabase;
}

export async function getServerUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

// Admin/service client for server-side operations (use SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY)
export function createAdminSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase server environment variables. Set SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
