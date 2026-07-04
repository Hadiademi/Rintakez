"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buildMonthMatrix } from "@/lib/month-grid";

function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Read-only month-grid availability calendar for the public profile.
 * Monday-start; unavailable days are muted + struck; today is outlined.
 * Only the prev/next month arrows change state — day cells are inert.
 */
export function AvailabilityCalendar({
  unavailableDates,
}: {
  unavailableDates: string[];
}) {
  const locale = useLocale();
  const t = useTranslations("profile");

  const today = useMemo(() => todayISO(), []);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // month 0-indexed
  });

  const unavailableSet = useMemo(
    () => new Set(unavailableDates),
    [unavailableDates]
  );

  const weeks = useMemo(
    () => buildMonthMatrix(cursor.year, cursor.month, unavailableSet, today),
    [cursor, unavailableSet, today]
  );

  // Localised month title + Monday-first weekday headers.
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(new Date(cursor.year, cursor.month, 1)),
    [locale, cursor]
  );

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-01 is a Monday — walk seven days for Mo…So order.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 1 + i))
    );
  }, [locale]);

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = month + delta;
      return {
        year: year + Math.floor(next / 12),
        month: ((next % 12) + 12) % 12,
      };
    });
  }

  return (
    <div className="space-y-3">
      <p className="label text-mute">{t("availTitle")}</p>

      <div className="w-full max-w-[320px] space-y-2">
        {/* Header: month name + nav arrows (≥44px tap targets) */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={t("availPrevMonth")}
            className="press flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-chip"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ‹
            </span>
          </button>
          <span className="text-[15px] font-medium capitalize text-ink">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={t("availNextMonth")}
            className="press flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-chip"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ›
            </span>
          </button>
        </div>

        {/* Weekday header row */}
        <div className="grid grid-cols-7">
          {weekdays.map((w, i) => (
            <div
              key={i}
              className="label flex h-7 items-center justify-center text-mute-2"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day cells (read-only, no click handlers) */}
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell) => {
            const day = Number(cell.dateISO.slice(8, 10));
            const base =
              "tabular flex h-10 items-center justify-center text-[13px]";
            if (!cell.inMonth) {
              return (
                <div
                  key={cell.dateISO}
                  className={`${base} text-mute-2 opacity-30`}
                >
                  {day}
                </div>
              );
            }
            const state = cell.isUnavailable
              ? "text-mute-2 line-through"
              : "text-ink";
            const todayRing = cell.isToday
              ? "rounded-full border border-accent"
              : "";
            return (
              <div key={cell.dateISO} className={base}>
                <span
                  className={`flex h-9 w-9 items-center justify-center ${state} ${todayRing}`}
                >
                  {day}
                </span>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[12px] text-mute">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-line bg-paper" />
            {t("availAvailable")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-chip" />
            <span className="line-through">{t("availUnavailable")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
