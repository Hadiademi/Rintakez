"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import type { Database } from "@/lib/supabase/database.types";

type ShootStatus = Database["public"]["Enums"]["shoot_status"];
type ShootType = Database["public"]["Enums"]["shoot_type"];

/** Plain, serializable row shape handed down from the server component —
 *  everything the client needs to render + filter, nothing more. */
export interface MyShootRow {
  id: string;
  imageUrl: string;
  type: ShootType;
  locationCity: string;
  canton: string;
  shootDate: string;
  title: string;
  budgetMin: number;
  budgetMax: number;
  status: ShootStatus;
  offerCount: number;
}

type Filter = "all" | ShootStatus;

const FILTER_ORDER: ShootStatus[] = ["open", "assigned", "completed", "cancelled"];

// Mirrors ShootStatusBadge's palette — duplicated here because that component
// is an async server component (calls next-intl/server) and can't be used
// from this client list.
const statusColor: Record<ShootStatus, string> = {
  open: "border-ink text-ink",
  assigned: "border-accent text-accent",
  completed: "border-line text-mute",
  cancelled: "border-line text-mute-2",
};

/** Status filter tabs (All/Open/Assigned/Completed/Cancelled, with counts)
 *  plus the rich shoot-row list, filtered client-side over the rows fetched
 *  once server-side. Mirrors the MyBidsList tab idiom. */
export function MyShootsList({ rows }: { rows: MyShootRow[] }) {
  const t = useTranslations("myShoots");
  const tShoot = useTranslations("shoot");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: rows.length,
      open: 0,
      assigned: 0,
      completed: 0,
      cancelled: 0,
    };
    for (const row of rows) c[row.status]++;
    return c;
  }, [rows]);

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("filterAll"), count: counts.all },
    ...FILTER_ORDER.map((status) => ({
      key: status,
      label: tShoot(`status.${status}`),
      count: counts[status],
    })),
  ];

  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

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
              data-testid={`my-shoots-tab-${tab.key}`}
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
        <div data-testid="my-shoots-list" className="divide-y divide-line">
          {shown.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 py-5 transition-colors hover:bg-surface"
            >
              <Link
                href={`/shoots/${row.id}`}
                data-testid={`my-shoot-${row.id}`}
                className="press flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
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
                      {tShoot(`types.${row.type}`)} · {row.locationCity},{" "}
                      {row.canton} · {formatSwissDate(row.shootDate)}
                    </p>
                    <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                      {row.title}
                    </h2>
                    <p className="mt-0.5 tabular text-sm text-mute">
                      {formatCHFRange(row.budgetMin, row.budgetMax)} ·{" "}
                      {tShoot("bidsCount", { count: row.offerCount })}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`label inline-block px-2 py-1 border ${statusColor[row.status]}`}
                  >
                    {tShoot(`status.${row.status}`)}
                  </span>
                  <span aria-hidden="true" className="hidden text-mute-2 sm:inline">
                    ›
                  </span>
                </div>
              </Link>

              {row.status === "open" && row.offerCount > 0 ? (
                <Link
                  href={`/shoots/${row.id}`}
                  className="press inline-block self-start pl-0 text-[13px] text-accent hover:opacity-70 sm:pl-[112px]"
                >
                  {t("reviewOffers", { count: row.offerCount })}
                </Link>
              ) : row.status === "open" && row.offerCount === 0 ? (
                <Link
                  href={`/photographers?canton=${row.canton}&type=${row.type}`}
                  data-testid={`find-photographers-cta-${row.id}`}
                  className="press inline-block self-start pl-0 text-[13px] text-accent hover:opacity-70 sm:pl-[112px]"
                >
                  {tShoot("findPhotographersCta")}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
