"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { resolveDispute } from "@/lib/actions/admin";

export function AdminDisputeRow({
  id,
  shootId,
  shootTitle,
  openedByName,
  reason,
  createdAt,
}: {
  id: string;
  shootId: string;
  shootTitle: string;
  openedByName: string;
  reason: string;
  createdAt: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function decide(status: "resolved" | "dismissed") {
    start(async () => {
      await resolveDispute(id, status, note);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-mute">
        <Link
          href={`/shoots/${shootId}`}
          className="font-medium text-accent hover:opacity-70"
        >
          {shootTitle}
        </Link>
        <span className="text-mute-2">·</span>
        <span>{openedByName}</span>
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => decide("resolved")}
          disabled={pending}
          className="press border border-line px-4 py-2 text-sm text-ink disabled:opacity-50"
        >
          {t("disputeResolve")}
        </button>
        <button
          type="button"
          onClick={() => decide("dismissed")}
          disabled={pending}
          className="press label text-mute hover:text-ink disabled:opacity-50"
        >
          {t("disputeDismiss")}
        </button>
      </div>
    </div>
  );
}
