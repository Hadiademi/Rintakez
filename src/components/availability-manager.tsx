"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  addUnavailableDate,
  removeUnavailableDate,
} from "@/lib/actions/availability";

export function AvailabilityManager({ initial }: { initial: string[] }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [dates, setDates] = useState<string[]>(initial);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  function add() {
    if (!value || dates.includes(value)) return;
    const date = value;
    setDates((prev) => [...prev, date].sort());
    setValue("");
    startTransition(async () => {
      const res = await addUnavailableDate(date);
      if (!res.ok) setDates((prev) => prev.filter((d) => d !== date));
      else router.refresh();
    });
  }

  function remove(date: string) {
    setDates((prev) => prev.filter((d) => d !== date));
    startTransition(async () => {
      const res = await removeUnavailableDate(date);
      if (!res.ok) setDates((prev) => [...prev, date].sort());
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4 border-t border-line pt-8">
      <div>
        <p className="label text-mute">{t("availTitle")}</p>
        <p className="mt-1 text-[14px] text-mute">{t("availSub")}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          min={today}
          value={value}
          data-testid="availability-date"
          onChange={(e) => setValue(e.target.value)}
          className="border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          data-testid="availability-add"
          onClick={add}
          disabled={isPending || !value}
          className="press bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-40"
        >
          {t("availAdd")}
        </button>
      </div>

      {dates.length === 0 ? (
        <p className="text-[14px] text-mute">{t("availEmpty")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => remove(d)}
              className="press tabular inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-[13px] text-ink hover:bg-line"
            >
              {d}
              <span className="text-mute-2">✕</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
