"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatCHF, formatCHFRange, formatSwissDate } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

type BidStatus = Database["public"]["Enums"]["bid_status"];
type ShootStatus = Database["public"]["Enums"]["shoot_status"];

/** Plain, serializable row shape handed down from the server component —
 *  everything the client needs to render + filter, nothing more. */
export interface MyBidRow {
  id: string;
  shootId: string;
  imageUrl: string;
  locationCity: string;
  canton: string;
  shootDate: string;
  title: string;
  createdAt: string;
  budgetMin: number;
  budgetMax: number;
  amountChf: number;
  status: BidStatus;
  shootStatus: ShootStatus;
}

type Filter = "all" | BidStatus;

const FILTER_ORDER: BidStatus[] = ["pending", "accepted", "declined", "withdrawn"];

// For the winning bid, the shoot's terminal state is the truth: an accepted
// bid on a cancelled/completed shoot must not keep reading as a live
// "Accepted" (mirrors the previous page's dot-status logic).
function isTerminalOverride(row: MyBidRow): boolean {
  return (
    row.status === "accepted" &&
    (row.shootStatus === "cancelled" || row.shootStatus === "completed")
  );
}

function badgeVariant(row: MyBidRow): "solid" | "outline" | "muted" {
  if (isTerminalOverride(row)) {
    return row.shootStatus === "completed" ? "solid" : "muted";
  }
  if (row.status === "accepted") return "solid";
  if (row.status === "pending") return "outline";
  return "muted";
}

const badgeClass: Record<"solid" | "outline" | "muted", string> = {
  solid: "border border-ink bg-ink text-paper",
  outline: "border border-line text-mute",
  muted: "border border-line text-mute-2",
};

/** Status filter tabs (All/Pending/Accepted/Declined/Withdrawn, with counts)
 *  plus the rich offer-row list, filtered client-side over the rows fetched
 *  once server-side. Mirrors the ConversationList tab idiom. */
export function MyBidsList({ rows }: { rows: MyBidRow[] }) {
  const t = useTranslations("myBids");
  const tBid = useTranslations("bid");
  const tShoot = useTranslations("shoot");
  const format = useFormatter();
  const [filter, setFilter] = useState<Filter>("all");
  // next-intl's relativeTime() throws (ENVIRONMENT_FALLBACK) unless a `now`
  // reference is passed explicitly — seed once so every row measures against
  // the same instant instead of `Date.now()` drifting per row.
  const [now] = useState(() => new Date());

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: rows.length,
      pending: 0,
      accepted: 0,
      declined: 0,
      withdrawn: 0,
    };
    for (const row of rows) c[row.status]++;
    return c;
  }, [rows]);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll"), count: counts.all },
    ...FILTER_ORDER.map((status) => ({
      key: status,
      label: tBid(`status.${status}`),
      count: counts[status],
    })),
  ];

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  function badgeLabel(row: MyBidRow): string {
    return isTerminalOverride(row)
      ? tShoot(`status.${row.shootStatus}`)
      : tBid(`status.${row.status}`);
  }

  return (
    <div>
      {/* Filter tabs — active tab underlined, count set in tabular figures. */}
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line"
      >
        {tabs.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.key)}
              className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 py-3 text-sm transition-colors ${
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-mute hover:text-ink"
              }`}
            >
              {tab.label}
              <span className="tabular text-[12px] text-mute-2">
                {String(tab.count).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-mute">{t("noneForFilter")}</p>
      ) : (
        <div data-testid="my-bids-list" className="divide-y divide-line">
          {shown.map((row) => (
            <Link
              key={row.id}
              href={`/shoots/${row.shootId}`}
              data-testid={`my-bid-${row.id}`}
              className="press flex flex-col gap-3 py-5 transition-colors hover:bg-surface sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 items-center gap-4 sm:flex-1">
                {/* Deterministic decorative placeholder for a shoot listing —
                    a raw <img> is fine, it's not user content. */}
                <img
                  src={row.imageUrl}
                  alt=""
                  width={160}
                  height={120}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-20 shrink-0 bg-chip object-cover grayscale"
                />
                <div className="min-w-0">
                  <p className="label truncate text-mute">
                    {row.locationCity}, {row.canton} ·{" "}
                    {formatSwissDate(row.shootDate)}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                    {row.title}
                  </h2>
                  <p className="mt-0.5 label text-mute-2">
                    {t("submittedAgo", {
                      time: format.relativeTime(new Date(row.createdAt), now),
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:shrink-0 sm:gap-x-8">
                <div className="shrink-0">
                  <p className="label text-mute">{t("budget")}</p>
                  <p className="tabular text-sm text-ink">
                    {formatCHFRange(row.budgetMin, row.budgetMax)}
                  </p>
                </div>
                <div className="shrink-0">
                  <p className="label text-mute">{t("yourOffer")}</p>
                  <p className="tabular text-base font-semibold text-ink">
                    {formatCHF(row.amountChf)}
                  </p>
                </div>
                <span
                  className={`label inline-block shrink-0 px-2 py-1 ${badgeClass[badgeVariant(row)]}`}
                >
                  {badgeLabel(row)}
                </span>
                <span
                  aria-hidden="true"
                  className="hidden shrink-0 text-mute-2 sm:inline"
                >
                  ›
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
