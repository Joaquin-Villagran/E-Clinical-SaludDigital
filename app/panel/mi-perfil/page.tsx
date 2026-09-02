import { redirect } from "next/navigation";
import SiteHeader from "@/app/components/site-header";
import DoctorProfileForm from "./doctor-profile-form";
import { createAdminSupabase, getServerUser } from "@/lib/supabase-server";

// El perfil usa doctors como fuente única; cada bloque se actualiza de forma independiente.
export default async function PanelMiPerfilPage() {
  const user = await getServerUser();
  if (!user || user.user_metadata?.role !== "doctor") redirect("/login");

  const metadata = user.user_metadata ?? {};
  const nombre = metadata.full_name || [metadata.first_name, metadata.last_name].filter(Boolean).join(" ") || null;
  const supabase = createAdminSupabase();
  const result = await supabase.from("doctors").upsert({ user_id: user.id, nombre, email: user.email ?? null, documento: metadata.documento ?? null, fecha_nacimiento: metadata.fecha_nacimiento ?? null, sexo: metadata.sexo ?? null, nacionalidad: metadata.nacionalidad ?? null }, { onConflict: "user_id" }).select().maybeSingle();
  if (result.error || !result.data) throw new Error(result.error?.message || "No se pudo cargar el perfil profesional.");
  const doctor = result.data;

  return <main className="min-h-screen bg-[var(--background)] pb-24 text-[var(--foreground)]"><SiteHeader /><section className="container mx-auto max-w-6xl px-6 py-10"><div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--card)] p-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[var(--accent)]">Mi perfil</p><h1 className="mt-2 text-3xl font-semibold text-[var(--primary)]">Perfil profesional</h1></div><DoctorProfileForm doctor={doctor} /></section></main>;
}