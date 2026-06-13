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
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return next;
  }

  function selectType(value: string) {
    router.push(`${pathname}?${buildParams({ type: value }).toString()}`);
  }
  function handleCanton(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`${pathname}?${buildParams({ canton: e.target.value }).toString()}`);
  }
  function handleBudgetMax(e: React.ChangeEvent<HTMLInputElement>) {
    router.push(`${pathname}?${buildParams({ budgetMax: e.target.value }).toString()}`);
  }
  function handleClear() {
    router.push(pathname);
  }

  const typeOptions = [
    { value: "", label: t("all") },
    ...SHOOT_TYPES.map((v) => ({ value: v, label: tShoot(`types.${v}`) })),
  ];

  const selectClass =
    "label w-full border border-line bg-surface px-3 py-2.5 text-ink";

  return (
    <div data-testid="filter-type">
      {/* ── Desktop: vertical sidebar ─────────────────────────────── */}
      <div className="hidden lg:block">
        <p className="label text-mute-2">{t("filterLabel")}</p>
        <div className="mt-4 flex flex-col border-t border-line">
          {typeOptions.map(({ value, label }) => {
            const active = type === value;
            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => selectType(value)}
                aria-pressed={active}
                className={`flex items-center justify-between border-b border-line py-3 text-left text-[15px] tracking-tight transition-colors ${
                  active ? "text-ink" : "text-mute hover:text-ink"
                }`}
              >
                {label}
                {active && <span className="h-1.5 w-1.5 bg-accent" />}
              </button>
            );
          })}
        </div>

        <p className="label mt-8 text-mute-2">{t("filterCanton")}</p>
        <select
          data-testid="filter-canton"
          value={canton}
          onChange={handleCanton}
          className={`${selectClass} mt-3`}
        >
          <option value="">{t("all")}</option>
          {CANTONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <p className="label mt-6 text-mute-2">{t("filterBudget")}</p>
        <input
          data-testid="filter-budget"
          type="number"
          min={0}
          value={budgetMax}
          onChange={handleBudgetMax}
          placeholder={t("filterBudget")}
          className={`${selectClass} mt-3`}
        />

        <button
          data-testid="filter-clear"
          type="button"
          onClick={handleClear}
          className="label mt-6 text-mute press hover:text-ink"
        >
          {t("clear")}
        </button>
      </div>

      {/* ── Mobile: horizontal chips + canton/budget ──────────────── */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {typeOptions.map(({ value, label }) => {
            const active = type === value;
            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => selectType(value)}
                aria-pressed={active}
                className={`label press inline-flex shrink-0 items-center border px-4 py-2.5 ${
                  active
                    ? "bg-ink text-paper border-ink"
                    : "border-line text-mute hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="label text-mute">{t("filterCanton")}</label>
            <select value={canton} onChange={handleCanton} className={selectClass}>
              <option value="">{t("all")}</option>
              {CANTONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="label text-mute">{t("filterBudget")}</label>
            <input
              type="number"
              min={0}
              value={budgetMax}
              onChange={handleBudgetMax}
              placeholder={t("filterBudget")}
              className={selectClass}
            />
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="label text-mute press pb-2.5 hover:text-ink"
          >
            {t("clear")}
          </button>
        </div>
      </div>
    </div>
  );
}
