"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Stars } from "@/components/stars";
import { formatCHF } from "@/lib/format";
import { sortBids, type BidSortMode } from "@/lib/bid-sort";
import { useBidDecision } from "@/components/use-bid-decision";

export type BidCompareItem = {
  id: string;
  amount_chf: number;
  message: string;
  createdAt: string;
  photographer: {
    id: string;
    display_name: string;
    avatarUrl: string | null;
    verified: boolean;
    memberSinceYear: number;
  } | null;
  rating: { avg: number; count: number };
  completedShoots: number;
};

const SORT_MODES: BidSortMode[] = ["price", "rating", "newest"];
// A message longer than this is clamped with a "read more" toggle. Short offers
// (the common case) stay fully visible with no toggle noise.
const CLAMP_THRESHOLD = 160;

/**
 * Side-by-side comparison of the pending offers on a shoot, shown to the owner
 * when there are ≥2 to weigh. Cards only (tables break at 390px); nothing is
 * highlighted as "recommended" — the owner picks the axis to sort by.
 *
 * Accepting and declining go through the same useBidDecision hook as the
 * single-bid BidCard, so both flows are behaviourally identical.
 */
export function BidCompare({
  bids,
  shootDateLabel,
}: {
  bids: BidCompareItem[];
  shootDateLabel: string;
}) {
  const t = useTranslations("shootDetail");
  const tc = useTranslations("shootDetail.compare");
  const [mode, setMode] = useState<BidSortMode>("newest");

  const sorted = useMemo(() => sortBids(bids, mode), [bids, mode]);

  return (
    <div className="space-y-5" data-testid="bid-compare">
      <div
        role="group"
        aria-label={tc("sortLabel")}
        className="flex w-full rounded-full border border-line bg-surface p-1 sm:inline-flex sm:w-auto"
      >
        {SORT_MODES.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              data-testid={`bid-sort-${m}`}
              aria-pressed={active}
              onClick={() => setMode(m)}
              className={`press flex-1 rounded-full px-4 py-2 label transition-colors sm:flex-none ${
                active ? "bg-ink text-paper" : "text-mute hover:text-ink"
              }`}
            >
              {tc(
                m === "price"
                  ? "sortPrice"
                  : m === "rating"
                    ? "sortRating"
                    : "sortNewest"
              )}
            </button>
          );
        })}
      </div>

      <div
        data-testid="bid-compare-grid"
        className="grid gap-4 sm:grid-cols-2"
      >
        {sorted.map((item) => (
          <CompareCard
            key={item.id}
            item={item}
            t={t}
            tc={tc}
            shootDateLabel={shootDateLabel}
          />
        ))}
      </div>
    </div>
  );
}

function CompareCard({
  item,
  t,
  tc,
  shootDateLabel,
}: {
  item: BidCompareItem;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  shootDateLabel: string;
}) {
  const tReview = useTranslations("review");
  const tProfile = useTranslations("profile");
  const [expanded, setExpanded] = useState(false);
  const { accept, decline, isPending, error } = useBidDecision({
    bidId: item.id,
    photographerName: item.photographer?.display_name ?? null,
    amountChf: item.amount_chf,
    shootDateLabel,
  });

  const p = item.photographer;
  const name = p?.display_name ?? t("byPhotographer");
  const rated = item.rating.count > 0;
  const clampable = item.message.length > CLAMP_THRESHOLD;

  const meta = [
    tProfile("memberSince", { year: p?.memberSinceYear ?? 0 }),
    item.completedShoots > 0
      ? tProfile("completedShoots", { count: item.completedShoots })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      data-testid={`bid-${item.id}`}
      className="flex flex-col border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} src={p?.avatarUrl} size={40} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {p ? (
                <Link
                  href={`/photographers/${p.id}`}
                  className="truncate font-medium text-ink hover:text-accent"
                >
                  {name}
                </Link>
              ) : (
                <span className="truncate font-medium text-ink">{name}</span>
              )}
              {p?.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px] font-normal text-accent">
                  ✓ {tProfile("verified")}
                </span>
              ) : null}
            </div>
            {p ? <p className="tabular text-[13px] text-mute">{meta}</p> : null}
          </div>
        </div>
        <span className="tabular shrink-0 text-2xl font-semibold tracking-tight text-ink">
          {formatCHF(item.amount_chf)}
        </span>
      </div>

      <div className="mt-3">
        {rated ? (
          <span className="flex items-center gap-1.5">
            <Stars value={item.rating.avg} size={13} />
            <span className="tabular text-[13px] text-mute">
              {item.rating.avg.toFixed(1)} ·{" "}
              {tReview("count", { count: item.rating.count })}
            </span>
          </span>
        ) : (
          <span className="label text-mute-2">{tReview("newBadge")}</span>
        )}
      </div>

      {item.message ? (
        <div className="mt-4">
          <p
            className={`whitespace-pre-line leading-relaxed text-mute ${
              clampable && !expanded ? "line-clamp-3" : ""
            }`}
          >
            {item.message}
          </p>
          {clampable ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="press mt-1 label text-accent hover:opacity-70"
            >
              {expanded ? tc("readLess") : tc("readMore")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto space-y-2 pt-5">
        <button
          type="button"
          data-testid={`bid-accept-${item.id}`}
          onClick={accept}
          disabled={isPending}
          aria-busy={isPending || undefined}
          className="press flex min-h-[44px] w-full items-center justify-center gap-2 bg-ink px-4 label text-paper disabled:opacity-50"
        >
          {isPending ? <Spinner className="h-3.5 w-3.5" /> : null}
          {t("accept")}
        </button>
        <button
          type="button"
          data-testid={`bid-decline-${item.id}`}
          onClick={decline}
          disabled={isPending}
          className="press flex min-h-[44px] w-full items-center justify-center border border-line px-4 label text-mute disabled:opacity-50"
        >
          {t("decline")}
        </button>
        <div className="flex items-center justify-between gap-3">
          {p ? (
            <Link
              href={`/photographers/${p.id}`}
              className="label text-mute hover:text-ink"
            >
              {tc("viewProfile")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-right text-[12px] text-mute-2">
            {tc("messageNote")}
          </span>
        </div>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
      </div>
    </article>
  );
}
