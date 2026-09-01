import SiteHeader from "@/app/components/site-header";
import LoginForm from "../../login-form";

export const metadata = {
  title: "Registrarse - Paciente",
};

export default async function RegistroPacientePage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-20">
        <div className="flex min-h-[70vh] items-center justify-center">
          <LoginForm initialMode="signup" forceAccountType="patient" hideAccountPicker singleColumn />
        </div>
      </section>
    </main>
  );
}
