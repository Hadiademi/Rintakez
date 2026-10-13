"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { completeShootAction } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toaster";

export function CompleteShootButton({ shootId }: { shootId: string }) {
  const t = useTranslations("review");
  const tErr = useTranslations("errors");
  const tc = useTranslations("confirm");
  const tToast = useTranslations("toast");
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onComplete() {
    // Completing is terminal (unlocks the review, can't be undone) — confirm,
    // like accept/decline/cancel/withdraw already do.
    const ok = await confirm({
      title: tc("completeTitle"),
      body: tc("completeBody"),
      confirmLabel: tc("completeAction"),
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await completeShootAction(shootId);
      if (res.ok) {
        toast(tToast("shootCompleted"), {
          description: tToast("shootCompletedDesc"),
        });
        router.refresh();
      } else setError(tErr(errorKey(res.error)));
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
