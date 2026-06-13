"use client";

import { useTranslations } from "next-intl";
import { logoutAction } from "@/lib/actions/auth";

interface SignOutButtonProps {
  showTestId?: boolean;
}

export function SignOutButton({ showTestId = true }: SignOutButtonProps) {
  const t = useTranslations("nav");
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="label press text-mute hover:text-ink"
        {...(showTestId ? { "data-testid": "sign-out" } : {})}
      >
        {t("signOut")}
      </button>
    </form>
  );
}
