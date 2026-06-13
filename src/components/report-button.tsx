"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { submitReport } from "@/lib/actions/reports";
import { errorKey } from "@/lib/error-messages";

export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "profile" | "shoot";
  targetId: string;
}) {
  const t = useTranslations("report");
  const tErr = useTranslations("errors");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit() {
    if (!reason.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await submitReport({ targetType, targetId, reason });
      if (res.ok) setDone(true);
      else setError(tErr(errorKey(res.error)));
    });
  }

  if (done) {
    return <p className="text-[13px] text-mute">{t("reportThanks")}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        data-testid="report-open"
        onClick={() => setOpen(true)}
        className="press text-[13px] text-mute-2 underline underline-offset-2 hover:text-ink"
      >
        {t("report")}
      </button>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-3 border border-line p-4">
      <p className="label text-mute">{t("reportTitle")}</p>
      <label htmlFor="report-reason" className="text-[13px] text-mute">
        {t("reportReason")}
      </label>
      <textarea
        id="report-reason"
        data-testid="report-reason"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("reportPlaceholder")}
        className="w-full resize-y border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          data-testid="report-submit"
          onClick={onSubmit}
          disabled={isPending || !reason.trim()}
          className="press bg-ink px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
        >
          {t("reportSubmit")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="press label text-mute hover:text-ink"
        >
          {t("cancel")}
        </button>
      </div>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
