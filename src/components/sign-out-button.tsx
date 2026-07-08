"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/lib/actions/auth";

interface SignOutButtonProps {
  showTestId?: boolean;
}

function SubmitButton({ showTestId }: { showTestId: boolean }) {
  const t = useTranslations("nav");
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="label press text-mute hover:text-ink disabled:opacity-50"
      {...(showTestId ? { "data-testid": "sign-out" } : {})}
    >
      {t("signOut")}
    </button>
  );
}

export function SignOutButton({ showTestId = true }: SignOutButtonProps) {
  return (
    <form action={logoutAction}>
      <SubmitButton showTestId={showTestId} />
    </form>
  );
}
