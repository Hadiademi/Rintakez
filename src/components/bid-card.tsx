"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatCHF } from "@/lib/format";
import { acceptBidAction, declineBidAction } from "@/lib/actions/shoots";

type BidStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type BidCardData = {
  id: string;
  amount_chf: number;
  message: string;
  status: BidStatus;
  photographer: {
    id: string;
    display_name: string;
    city: string | null;
    canton: string | null;
  } | null;
};

export function BidCard({
  bid,
  canManage,
}: {
  bid: BidCardData;
  canManage: boolean;
}) {
  const t = useTranslations("shootDetail");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const photographer = bid.photographer;
  const location =
    photographer?.city && photographer?.canton
      ? `${photographer.city}, ${photographer.canton}`
      : photographer?.city || photographer?.canton || null;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function onAccept() {
    if (typeof window !== "undefined" && !window.confirm(t("accept") + "?")) {
      return;
    }
    run(() => acceptBidAction(bid.id));
  }

  function onDecline() {
    run(() => declineBidAction(bid.id));
  }

  const nameNode = photographer ? (
    <Link
      href={`/photographers/${photographer.id}`}
      className="font-medium text-ink hover:text-accent"
    >
      {photographer.display_name}
    </Link>
  ) : (
    <span className="font-medium text-ink">{t("byPhotographer")}</span>
  );

  return (
    <article
      data-testid={`bid-${bid.id}`}
      className="border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm">{nameNode}</div>
          {location ? (
            <p className="mt-0.5 text-sm text-mute">{location}</p>
          ) : null}
        </div>
        <span className="tabular text-lg font-medium text-ink">
          {formatCHF(bid.amount_chf)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-line text-sm text-mute">{bid.message}</p>

      <div className="mt-4 flex items-center justify-between gap-4">
        <span
          data-testid={`bid-status-${bid.id}`}
          className="label text-mute-2"
        >
          {bid.status === "accepted"
            ? t("accept")
            : bid.status === "declined"
              ? t("decline")
              : bid.status}
        </span>

        {canManage && bid.status === "pending" ? (
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={`bid-decline-${bid.id}`}
              onClick={onDecline}
              disabled={isPending}
              className="press border border-line px-3 py-1.5 label text-mute disabled:opacity-50"
            >
              {t("decline")}
            </button>
            <button
              type="button"
              data-testid={`bid-accept-${bid.id}`}
              onClick={onAccept}
              disabled={isPending}
              className="press bg-ink px-3 py-1.5 label text-paper disabled:opacity-50"
            >
              {t("accept")}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
    </article>
  );
}
