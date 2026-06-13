"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { updateReportStatus } from "@/lib/actions/admin";

export function AdminReportRow({
  id,
  reporterName,
  targetType,
  targetLabel,
  targetHref,
  reason,
  createdAt,
}: {
  id: string;
  reporterName: string;
  targetType: string;
  targetLabel: string;
  targetHref: string | null;
  reason: string;
  createdAt: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(status: "reviewed" | "dismissed") {
    startTransition(async () => {
      await updateReportStatus(id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
        <span className="label">{targetType}</span>
        {targetHref ? (
          <Link href={targetHref} className="text-accent hover:opacity-70">
            {targetLabel}
          </Link>
        ) : (
          <span className="text-ink">{targetLabel}</span>
        )}
        <span className="text-mute-2">·</span>
        <span>
          {t("reporter")}: {reporterName}
        </span>
        <span className="text-mute-2">·</span>
        <span className="tabular">{createdAt.slice(0, 10)}</span>
      </div>

      <p className="whitespace-pre-line text-[14px] text-ink">{reason}</p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStatus("reviewed")}
          disabled={isPending}
          className="press border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {t("markReviewed")}
        </button>
        <button
          type="button"
          onClick={() => setStatus("dismissed")}
          disabled={isPending}
          className="press label text-mute hover:text-ink disabled:opacity-50"
        >
          {t("markDismissed")}
        </button>
      </div>
    </div>
  );
}
