"use server";

import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export type RegisterResult =
  | { ok: true; session: boolean }
  | { ok: false; error: string };

export async function registerAction(raw: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { email, password, displayName, role, locale } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName, role, locale } },
  });
  if (error) return { ok: false, error: error.message };
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
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/", locale });
}
