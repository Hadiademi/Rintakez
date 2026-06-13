import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback. Exchanges the provider code for a session, then — for a brand
 * new OAuth user — applies the role chosen on the register page (no-op for
 * existing/confirmed users, enforced in set_initial_role). Locale-agnostic by
 * design; it redirects into the locale-prefixed app afterwards.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role");
  const locale = searchParams.get("locale") ?? "de";
  const next = searchParams.get("next") ?? `/${locale}/home`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (role === "client" || role === "photographer") {
        await supabase.rpc("set_initial_role", { p_role: role });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth`);
}
