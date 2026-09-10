import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

const getSafeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/login?confirmed=true";
  }

  return value;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeNextPath(url.searchParams.get("next"));
  const supabase = await createServerSupabase();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : { error: new Error("El enlace de verificación está incompleto o vencido.") };

  if (error) {
    const errorUrl = new URL("/login", url.origin);
    errorUrl.searchParams.set("error", "verification_failed");
    errorUrl.searchParams.set("error_description", error.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(nextPath, url.origin));
}