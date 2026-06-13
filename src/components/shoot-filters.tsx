"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { CANTONS, SHOOT_TYPES } from "@/lib/validation/photographer";

export function ShootFilters() {
  const t = useTranslations("browse");
  const tShoot = useTranslations("shoot");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canton = searchParams.get("canton") ?? "";
  const type = searchParams.get("type") ?? "";
  const budgetMax = searchParams.get("budgetMax") ?? "";

  function buildParams(overrides: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    return next;
  }

  function handleCanton(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = buildParams({ canton: e.target.value });
    router.push(`${pathname}?${params.toString()}`);
  }

  function selectType(value: string) {
    const params = buildParams({ type: value });
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleBudgetMax(e: React.ChangeEvent<HTMLInputElement>) {
    const params = buildParams({ budgetMax: e.target.value });
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleClear() {
    router.push(pathname);
  }

  const chipBase =
    "label press inline-flex items-center justify-center border px-4 py-2.5";
  const chipActive = "bg-ink text-paper border-ink";
  const chipInactive = "border-line text-mute hover:text-ink";

  const hasMoreFilters = Boolean(canton) || Boolean(budgetMax);

  const selectClass =
    "label border border-line bg-surface px-3 py-2.5 text-ink";

  return (
    <div className="space-y-4">
      {/* Type chips + filter-icon toggle */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div data-testid="filter-type" className="flex items-center gap-2">
          {/* ALLE */}
          <button
            type="button"
            onClick={() => selectType("")}
            aria-pressed={type === ""}
            className={`${chipBase} ${type === "" ? chipActive : chipInactive}`}
          >
            {t("all")}
          </button>

          {SHOOT_TYPES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => selectType(v)}
              aria-pressed={type === v}
              className={`${chipBase} ${type === v ? chipActive : chipInactive}`}
            >
              {tShoot(`types.${v}`)}
            </button>
          ))}
        </div>

        {/* Filter-icon button — square, matches the Atelier design */}
        <span
          aria-hidden="true"
          className={`${chipBase} ml-auto shrink-0 ${
            hasMoreFilters ? chipActive : chipInactive
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
            <circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" />
            <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
            <circle cx="8" cy="17" r="2" fill="currentColor" stroke="none" />
          </svg>
        </span>
      </div>

      {/* Canton / budget panel */}
      <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
        {/* Canton filter */}
        <div className="flex flex-col gap-1.5">
          <label className="label text-mute">{t("filterCanton")}</label>
          <select
            data-testid="filter-canton"
            value={canton}
            onChange={handleCanton}
            className={selectClass}
          >
            <option value="">{t("all")}</option>
            {CANTONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Budget max filter */}
        <div className="flex flex-col gap-1.5">
          <label className="label text-mute">{t("filterBudget")}</label>
          <input
            data-testid="filter-budget"
            type="number"
            min={0}
            value={budgetMax}
            onChange={handleBudgetMax}
            placeholder={t("filterBudget")}
            className={selectClass}
          />
        </div>

        {/* Clear */}
        <button
          data-testid="filter-clear"
          type="button"
          onClick={handleClear}
          className="label text-mute press pb-2.5 hover:text-ink"
        >
          {t("clear")}
        </button>
      </div>
    </div>
  );
}
