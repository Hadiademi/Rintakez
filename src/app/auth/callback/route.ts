import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A freshly-created OAuth user is one whose account was minted by this very
// code exchange; created_at is therefore within seconds of now. Email signups
// already fire the Plausible `signup` event client-side (register-form.tsx);
// this window lets the callback flag OAuth signups the same way (a returning
// Google user has an old created_at and is not counted).
const NEW_USER_WINDOW_MS = 60_000;

/**
 * OAuth callback. Exchanges the provider code for a session, then — for a brand
 * new OAuth user — applies the role chosen on the register page (no-op for
 * existing/confirmed users, enforced in set_initial_role) and appends a
 * one-shot `?signup=1` flag so the landing can fire the `signup` analytics
 * event. Locale-agnostic by design; it redirects into the locale-prefixed app.
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
      // First-session detection: a brand-new account has a just-set created_at.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const isNewUser =
        !!user?.created_at &&
        Date.now() - new Date(user.created_at).getTime() < NEW_USER_WINDOW_MS;

      const target = new URL(next, origin);
      if (isNewUser) target.searchParams.set("signup", "1");
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth`);
}
