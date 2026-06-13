"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { cancelShootAction } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";

export function CancelShootButton({ shootId }: { shootId: string }) {
  const t = useTranslations("shootDetail");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onCancel() {
    if (typeof window !== "undefined" && !window.confirm(t("cancelShoot") + "?")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelShootAction(shootId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        data-testid="cancel-shoot"
        onClick={onCancel}
        disabled={isPending}
        className="press border border-line px-3 py-1.5 label text-mute disabled:opacity-50"
      >
        {t("cancelShoot")}
      </button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
