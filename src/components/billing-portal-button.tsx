"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createPortalSession } from "@/lib/actions/billing";
import { errorKey } from "@/lib/error-messages";

/**
 * Client-only wrapper for the Stripe Customer Portal CTA on the profile
 * billing tab — server components can't run a server action from an onClick,
 * so this mirrors admin-user-row's transition + errorKey pattern.
 */
export function BillingPortalButton() {
  const t = useTranslations("profile");
  const tErr = useTranslations("errors");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleManage() {
    setError(null);
    startTransition(async () => {
      const res = await createPortalSession();
      if (res.ok) {
        window.location.assign(res.url);
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleManage}
        disabled={isPending}
        className="press border border-line px-4 py-3 label text-ink disabled:opacity-50"
      >
        {t("billingManage")}
      </button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
