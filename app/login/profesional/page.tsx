import SiteHeader from "@/app/components/site-header";
import LoginForm from "../login-form";

export const metadata = {
  title: "Ingresar - Profesional",
};

export default async function LoginProfesionalPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <section className="container mx-auto px-6 py-20">
        <div className="flex min-h-[70vh] items-center justify-center">
          <LoginForm initialMode="login" forceAccountType="doctor" hideAccountPicker singleColumn />
        </div>
      </section>
    </main>
  );
}
