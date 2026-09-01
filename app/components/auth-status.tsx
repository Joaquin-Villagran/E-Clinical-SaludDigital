"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function AuthStatus() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then((result: any) => {
        if (mounted) {
          setSession(result.data?.session ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (mounted) {
        setSession(session ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
    } catch (e) {
      // ignore
    }
    router.push("/login");
  };

  if (loading) {
    return null;
  }

  if (!session) {
    return (
      <Link href="/login" className="rounded-full border border-[var(--border)] px-4 py-2 text-sm text-[var(--foreground)]/80 transition hover:bg-[var(--accent)]/10">
        Iniciar Sesión
      </Link>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
    >
      Cerrar sesión
    </button>
  );
}
