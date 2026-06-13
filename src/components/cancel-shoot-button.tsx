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
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const res = await cancelShootAction(shootId, reason);
      if (res.ok) router.refresh();
      else setError(tErr(errorKey(res.error)));
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="cancel-shoot"
        onClick={() => setOpen(true)}
        className="press label border border-line px-4 py-2 text-mute"
      >
        {t("cancelShoot")}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 border border-line p-4">
      <p className="text-[14px] text-mute">{t("cancelPolicy")}</p>
      <div className="flex w-full flex-col gap-1.5">
        <label htmlFor="cancel-reason" className="label text-mute">
          {t("cancelReasonLabel")}
        </label>
        <textarea
          id="cancel-reason"
          data-testid="cancel-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("cancelReasonPlaceholder")}
          className="w-full resize-y border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="cancel-shoot-confirm"
          onClick={onConfirm}
          disabled={isPending}
          className="press bg-accent px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-50"
        >
          {t("cancelShoot")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          aria-label="close"
          className="press label text-mute hover:text-ink"
        >
          ✕
        </button>
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
