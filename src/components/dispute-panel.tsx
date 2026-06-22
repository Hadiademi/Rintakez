"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { openDispute } from "@/lib/actions/disputes";

export function DisputePanel({
  shootId,
  existingStatus,
}: {
  shootId: string;
  existingStatus: "open" | "resolved" | "dismissed" | null;
}) {
  const t = useTranslations("dispute");
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (existingStatus) {
    return (
      <p className="text-[13px] text-mute">
        {t("existing")}: {t(`status.${existingStatus}`)}
      </p>
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await openDispute(shootId, { reason });
      if (r.ok) {
        setShow(false);
        setReason("");
        router.refresh();
      } else {
        setError(t("error"));
      }
    });
  }

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="press text-[13px] text-mute hover:text-ink"
      >
        {t("open")}
      </button>
    );
  }

  return (
    <div className="space-y-2 border border-line p-4">
      <p className="label text-mute">{t("open")}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder={t("placeholder")}
        className="w-full resize-none border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
      />
      {error && <p className="text-[13px] text-accent">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || reason.trim().length < 10}
          className="press border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {t("submit")}
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="press label text-mute hover:text-ink"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
