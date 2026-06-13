"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 35.9 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

/**
 * "Continue with Google". On the register page a `role` is passed so a brand
 * new OAuth user is created with the role they chose; on the login page no role
 * is needed (existing users keep theirs).
 */
export function GoogleButton({ role }: { role?: "client" | "photographer" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const supabase = createClient();
    const params = new URLSearchParams({ locale });
    if (role) params.set("role", role);
    const redirectTo = `${window.location.origin}/auth/callback?${params.toString()}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) setBusy(false);
  }

  return (
    <button
      type="button"
      data-testid="google-signin"
      onClick={onClick}
      disabled={busy}
      className="press flex w-full items-center justify-center gap-2.5 border border-line bg-paper py-3 text-[14px] font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
    >
      <GoogleGlyph />
      {t("continueWithGoogle")}
    </button>
  );
}
