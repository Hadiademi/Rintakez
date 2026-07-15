"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/stars";
import { formatCHF } from "@/lib/format";
import { acceptBidAction, declineBidAction } from "@/lib/actions/shoots";
import { errorKey } from "@/lib/error-messages";
import { track } from "@/lib/track";

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
  /** Storage-resolved avatar URL, or an already-absolute external URL. */
  avatarUrl?: string | null;
  rating?: { avg: number; count: number };
  verified?: boolean;
};

export function BidCard({
  bid,
  canManage,
}: {
  bid: BidCardData;
  canManage: boolean;
}) {
  const t = useTranslations("shootDetail");
  const tBid = useTranslations("bid");
  const tProfile = useTranslations("profile");
  const tErr = useTranslations("errors");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const photographer = bid.photographer;
  const location =
    photographer?.city && photographer?.canton
      ? `${photographer.city}, ${photographer.canton}`
      : photographer?.city || photographer?.canton || null;
  const rated = !!bid.rating && bid.rating.count > 0;

  function run(
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    onOk?: () => void
  ) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  function onAccept() {
    if (typeof window !== "undefined" && !window.confirm(t("acceptConfirm"))) {
      return;
    }
    run(
      () => acceptBidAction(bid.id),
      () => track("accept_bid")
    );
  }

  function onDecline() {
    // Decline is irreversible and emails the photographer — confirm first, like
    // accept (the two buttons sit side by side and a mis-tap is easy on mobile).
    if (typeof window !== "undefined" && !window.confirm(t("declineConfirm"))) {
      return;
    }
    run(() => declineBidAction(bid.id));
  }

  const nameNode = photographer ? (
    <Link
      href={`/photographers/${photographer.id}`}
      className="truncate font-medium text-ink hover:text-accent"
    >
      {photographer.display_name}
    </Link>
  ) : (
    <span className="font-medium text-ink">{t("byPhotographer")}</span>
  );

  return (
    <article
      data-testid={`bid-${bid.id}`}
      className="border border-line bg-surface p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar
            name={photographer?.display_name ?? t("byPhotographer")}
            src={bid.avatarUrl}
            size={44}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="text-base font-semibold">{nameNode}</div>
              {bid.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px] font-normal text-accent">
                  ✓ {tProfile("verified")}
                </span>
              ) : null}
            </div>
            {location ? (
              <p className="mt-0.5 label text-mute">{location}</p>
            ) : null}
            {rated ? (
              <p className="mt-1 flex items-center gap-1.5">
                <Stars value={bid.rating!.avg} size={12} />
                <span className="tabular text-[12px] text-mute">
                  {bid.rating!.avg.toFixed(1)} ({bid.rating!.count})
                </span>
              </p>
            ) : null}
          </div>
        </div>
        <span className="tabular shrink-0 text-2xl font-semibold tracking-tight text-ink">
          {formatCHF(bid.amount_chf)}
        </span>
      </div>

      {bid.message ? (
        <p className="mt-4 whitespace-pre-line leading-relaxed text-mute">
          {bid.message}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <div className="flex items-center gap-4">
          {photographer ? (
            <Link
              href={`/photographers/${photographer.id}`}
              className="press label text-mute hover:text-ink"
            >
              {tBid("viewProfile")} →
            </Link>
          ) : null}
          <span
            data-testid={`bid-status-${bid.id}`}
            className="label text-mute-2"
          >
            {tBid(`status.${bid.status}`)}
          </span>
        </div>

        {canManage && bid.status === "pending" ? (
          <div className="flex gap-2">
            <button
              type="button"
              data-testid={`bid-decline-${bid.id}`}
              onClick={onDecline}
              disabled={isPending}
              className="press border border-line px-4 py-2 label text-mute disabled:opacity-50"
            >
              {t("decline")}
            </button>
            <button
              type="button"
              data-testid={`bid-accept-${bid.id}`}
              onClick={onAccept}
              disabled={isPending}
              className="press bg-ink px-4 py-2 label text-paper disabled:opacity-50"
            >
              {t("accept")}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
    </article>
  );
}
