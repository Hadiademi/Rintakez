"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/lib/actions/auth";

export function SignOutButton() {
  const t = useTranslations("nav");
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="label press text-mute hover:text-ink"
        data-testid="sign-out"
      >
        {t("signOut")}
      </button>
    </form>
  );
}
