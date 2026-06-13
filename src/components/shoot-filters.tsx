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

  function handleType(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = buildParams({ type: e.target.value });
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleBudgetMax(e: React.ChangeEvent<HTMLInputElement>) {
    const params = buildParams({ budgetMax: e.target.value });
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleClear() {
    router.push(pathname);
  }

  const selectClass =
    "rounded-lg border border-line bg-surface px-3 py-2 text-ink";

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Canton filter */}
      <div className="flex flex-col gap-1">
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

      {/* Type filter */}
      <div className="flex flex-col gap-1">
        <label className="label text-mute">{t("filterType")}</label>
        <select
          data-testid="filter-type"
          value={type}
          onChange={handleType}
          className={selectClass}
        >
          <option value="">{t("all")}</option>
          {SHOOT_TYPES.map((v) => (
            <option key={v} value={v}>
              {tShoot(`types.${v}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Budget max filter */}
      <div className="flex flex-col gap-1">
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
        className="label text-mute press pb-2"
      >
        {t("clear")}
      </button>
    </div>
  );
}
