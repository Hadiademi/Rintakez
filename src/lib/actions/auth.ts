"use server";

import { dbError } from "@/lib/action-error";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
} from "@/lib/validation/auth";
import { TERMS_VERSION } from "@/lib/legal";
import { rateLimit } from "@/lib/rate-limit";

type ActionResult = { ok: true } | { ok: false; error: string };

export type RegisterResult =
  | { ok: true; session: boolean }
  | { ok: false; error: string };

export async function registerAction(raw: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { email, password, displayName, role, locale } = parsed.data;
  // 5/hour per email — registration is otherwise unlimited and cheap to script.
  if (!(await rateLimit(`register:${email}`, 5, 3_600_000)))
    return { ok: false, error: "limit_reached" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role, locale, terms_version: TERMS_VERSION },
    },
  });
  if (error) {
    // "user already registered" is the most common register dead-end — name it.
    const code = (error as { code?: string }).code;
    if (code === "user_already_exists")
      return { ok: false, error: "email_taken" };
    return { ok: false, error: dbError(error, "auth") };
  }
  // When local confirmations are disabled, signUp returns a live session and
  // would auto-log-in the user. We instead send them to the login page, so the
  // session is torn down here before returning.
  const hadSession = !!data.session;
  if (hadSession) await supabase.auth.signOut();
  return { ok: true, session: hadSession };
}

export async function loginAction(raw: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  // 10 attempts / 15 min per email — slows down credential-stuffing without
  // punishing a normal user who mistypes their password once or twice.
  if (!(await rateLimit(`login:${parsed.data.email}`, 10, 900_000)))
    return { ok: false, error: "limit_reached" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Map the common auth dead-ends to clear messages instead of "generic".
    const code = (error as { code?: string }).code;
    if (code === "invalid_credentials")
      return { ok: false, error: "invalid_credentials" };
    if (code === "email_not_confirmed")
      return { ok: false, error: "email_not_confirmed" };
    return { ok: false, error: dbError(error, "auth") };
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/", locale });
}

/**
 * Request a password-reset email. Server action (rather than the previous
 * direct client-side `resetPasswordForEmail` call) so the rate limit below can
 * actually be enforced — a client-only call cannot be trusted to throttle
 * itself. Always resolves `{ ok: true }` on a normal request so the response
 * never reveals whether an account exists for the given email; only the
 * limit-exceeded case returns an error, which does not leak that signal
 * either (it fires the same way regardless of whether the email is
 * registered).
 */
export async function forgotPasswordAction(
  raw: unknown
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { email } = parsed.data;
  // 5/hour per email — matches register; a reset-email bomb is otherwise free.
  if (!(await rateLimit(`pwreset:${email}`, 5, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const locale = await getLocale();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Becomes {{ .RedirectTo }} in the email template. Prod templates link to
  // /auth/confirm (token_hash + verifyOtp — works from any device/webview)
  // and forward this as `next`; the local default template still routes via
  // the PKCE callback, which this URL also survives as a plain destination.
  const redirectTo = `${siteUrl}/${locale}/reset-password`;
  const supabase = await createClient();
  // Ignore the result to avoid leaking whether an account exists.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { ok: true };
}
