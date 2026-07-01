"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import {
  updateReportStatus,
  setUserSuspension,
  setShootSuspension,
} from "@/lib/actions/admin";
import { errorKey } from "@/lib/error-messages";

export function AdminReportRow({
  id,
  reporterName,
  targetTypeLabel,
  targetKind,
  targetId,
  targetSuspended,
  targetLabel,
  targetHref,
  category,
  reason,
  createdAt,
}: {
  id: string;
  reporterName: string;
  targetTypeLabel: string;
  targetKind: "profile" | "shoot" | "review" | "message";
  targetId: string;
  targetSuspended: boolean;
  targetLabel: string;
  targetHref: string | null;
  category: "spam" | "harassment" | "scam" | "inappropriate_content" | "other";
  reason: string;
  createdAt: string;
}) {
  const t = useTranslations("admin");
  const tReport = useTranslations("report");
  const tErr = useTranslations("errors");
  // Suspension is only meaningful for profile/shoot targets (they carry an
  // is_suspended flag); reviews and messages have no such action here.
  const canSuspend = targetKind === "profile" || targetKind === "shoot";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function resolve(status: "reviewed" | "dismissed") {
    setError(null);
    startTransition(async () => {
      const r = await updateReportStatus(id, status, note);
      if (r.ok) router.refresh();
      else setError(tErr(errorKey(r.error)));
    });
  }

  function toggleSuspension() {
    if (!canSuspend) return;
    setError(null);
    startTransition(async () => {
      const r =
        targetKind === "profile"
          ? await setUserSuspension(targetId, !targetSuspended, note)
          : await setShootSuspension(targetId, !targetSuspended, note);
      if (r.ok) router.refresh();
      else setError(tErr(errorKey(r.error)));
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
        <span className="label">{targetTypeLabel}</span>
        {targetHref ? (
          <Link href={targetHref} className="text-accent hover:opacity-70">
            {targetLabel}
          </Link>
        ) : (
          <span className="text-ink">{targetLabel}</span>
        )}
        {targetSuspended ? (
          <span className="label rounded bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {t("suspended")}
          </span>
        ) : null}
        <span className="text-mute-2">·</span>
        <span className="label">{tReport(`categories.${category}`)}</span>
        <span className="text-mute-2">·</span>
        <span>
          {t("reporter")}: {reporterName}
        </span>
        <span className="text-mute-2">·</span>
        <span className="tabular">{createdAt.slice(0, 10)}</span>
      </div>

      <p className="whitespace-pre-line text-[14px] text-ink">{reason}</p>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("notePlaceholder")}
        rows={2}
        className="w-full resize-none border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-mute-2"
      />

      <div className="flex flex-wrap items-center gap-3">
        {canSuspend ? (
          <button
            type="button"
            onClick={toggleSuspension}
            disabled={isPending}
            className="press border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
          >
            {targetSuspended
              ? targetKind === "profile"
                ? t("unsuspendUser")
                : t("unsuspendShoot")
              : targetKind === "profile"
                ? t("suspendUser")
                : t("suspendShoot")}
          </button>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => resolve("reviewed")}
          disabled={isPending}
          className="press border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {t("markReviewed")}
        </button>
        <button
          type="button"
          onClick={() => resolve("dismissed")}
          disabled={isPending}
          className="press label text-mute hover:text-ink disabled:opacity-50"
        >
          {t("markDismissed")}
        </button>
      </div>

      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}
