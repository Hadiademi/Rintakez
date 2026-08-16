import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link confirmation via token_hash + verifyOtp — the SSR-safe flow for
 * links opened ANYWHERE (Gmail app webview, another browser, another device).
 *
 * The previous flow sent email links through /auth/callback's PKCE code
 * exchange, which only succeeds in the browser that initiated the request
 * (the code_verifier lives in ITS cookies). A password reset requested on the
 * laptop but opened on the phone landed on /login with no session and no
 * explanation. The prod auth-email templates now link here with
 * {{ .TokenHash }}, which verifyOtp validates server-side with no dependency
 * on prior cookies.
 *
 * `next` comes from the email template's {{ .RedirectTo }} and is only
 * followed when it stays on this origin (open-redirect guard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const locale = searchParams.get("locale") ?? "de";
  const rawNext = searchParams.get("next") ?? `/${locale}/home`;

  let target = new URL(rawNext, origin);
  if (target.origin !== origin) target = new URL(`/${locale}/home`, origin);

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(target);
  }

  // Expired or already-used link: land the user somewhere they can ACT —
  // recovery goes back to the request-a-link form, everything else to login —
  // with a banner explaining what happened (?error=expired).
  const fallback =
    type === "recovery"
      ? `/${locale}/forgot-password?error=expired`
      : `/${locale}/login?error=expired`;
  return NextResponse.redirect(new URL(fallback, origin));
}
