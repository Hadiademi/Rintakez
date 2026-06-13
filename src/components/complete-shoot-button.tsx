"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { completeShootAction } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";

export function CompleteShootButton({ shootId }: { shootId: string }) {
  const t = useTranslations("review");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onComplete() {
    setError(null);
    startTransition(async () => {
      const res = await completeShootAction(shootId);
      if (res.ok) router.refresh();
      else setError(tErr(errorKey(res.error)));
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-[14px] text-mute">{t("completedHint")}</p>
      <button
        type="button"
        data-testid="complete-shoot"
        onClick={onComplete}
        disabled={isPending}
        className="press bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
      >
        {t("markCompleted")}
      </button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
