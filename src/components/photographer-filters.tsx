"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { SHOOT_TYPES, CANTONS } from "@/lib/validation/photographer";

const MIN_RATINGS = [3, 4, 4.5] as const;

type Option = { value: string; label: string; testId?: string };

/** Vertical option list: uppercase label heading, hairline rules, the active
 * option bold with a small terracotta square marker — the Atelier sidebar
 * filter idiom (mirrors ShootFilters' desktop list). */
function FilterList({
  testId,
  heading,
  options,
  activeValue,
  onSelect,
  scroll,
}: {
  testId: string;
  heading: string;
  options: Option[];
  activeValue: string;
  onSelect: (value: string) => void;
  /** Long lists (e.g. 26 cantons) scroll within a bounded height instead of
   * stretching the sidebar. */
  scroll?: boolean;
}) {
  return (
    <div data-testid={testId}>
      <p className="label text-mute-2">{heading}</p>
      <div
        className={`mt-3 flex flex-col border-t border-line ${
          scroll ? "max-h-64 overflow-y-auto" : ""
        }`}
      >
        {options.map((o) => {
          const active = o.value === activeValue;
          return (
            <button
              key={o.value || "_all"}
              type="button"
              data-testid={o.testId ?? `${testId}-${o.value || "all"}`}
              aria-pressed={active}
              onClick={() => onSelect(o.value)}
              className={`flex min-h-11 items-center justify-between gap-3 border-b border-line py-2.5 text-left text-[14px] tracking-tight transition-colors ${
                active ? "font-medium text-ink" : "text-mute hover:text-ink"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {active && <span className="h-2 w-2 shrink-0 bg-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Track+knob switch, squared off (not pill-shaped) to match the sidebar's
 * square-corner idiom. */
function FilterSwitch({
  testId,
  label,
  checked,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-[14px] text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        onClick={() => onChange(!checked)}
        className={`press relative h-6 w-11 shrink-0 border transition-colors ${
          checked ? "border-ink bg-ink" : "border-line bg-surface"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 transition-all ${
            checked ? "left-[22px] bg-paper" : "left-0.5 bg-mute"
          }`}
        />
      </button>
    </div>
  );
}

export function PhotographerFilters() {
  const t = useTranslations("directory");
  const tShoot = useTranslations("shoot");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change returns to the first page
    router.push(`${pathname}?${next.toString()}`);
  }

  // Any active filter (ignoring pagination) enables the reset.
  const hasFilters = [
    "type",
    "canton",
    "discipline",
    "minRating",
    "saved",
    "verified",
    "sort",
    "q",
  ].some((k) => params.get(k));

  function clearAll() {
    router.push(pathname);
  }

  const typeValue = params.get("type") ?? "";
  const cantonValue = params.get("canton") ?? "";
  const disciplineValue = params.get("discipline") ?? "";
  const minRatingValue = params.get("minRating") ?? "";
  const sortValue = params.get("sort") ?? "rating";
  const verifiedOn = !!params.get("verified");
  const savedOn = !!params.get("saved");

  function renderSections(): ReactNode {
    return (
      <div className="flex flex-col gap-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("q");
            setParam("q", typeof v === "string" ? v.trim() : "");
          }}
          className="flex gap-2"
        >
          <input
            key={params.get("q") ?? ""}
            name="q"
            type="search"
            defaultValue={params.get("q") ?? ""}
            placeholder={t("searchName")}
            data-testid="filter-search"
            className="min-h-11 w-full border border-line bg-surface px-3.5 text-[14px] text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            data-testid="filter-search-submit"
            className="press min-h-11 shrink-0 border border-line px-4 text-[14px] text-ink hover:border-ink"
          >
            {t("search")}
          </button>
        </form>

        <FilterList
          testId="filter-specialty"
          heading={t("filterSpecialty")}
          activeValue={typeValue}
          onSelect={(v) => setParam("type", v)}
          options={[
            { value: "", label: t("allSpecialties") },
            ...SHOOT_TYPES.map((v) => ({
              value: v,
              label: tShoot(`types.${v}`),
            })),
          ]}
        />

        <FilterList
          testId="filter-canton"
          heading={t("filterRegion")}
          activeValue={cantonValue}
          onSelect={(v) => setParam("canton", v)}
          scroll
          options={[
            { value: "", label: t("allCantons") },
            ...CANTONS.map((c) => ({ value: c, label: c })),
          ]}
        />

        <FilterList
          testId="filter-discipline"
          heading={t("filterDiscipline")}
          activeValue={disciplineValue}
          onSelect={(v) => setParam("discipline", v)}
          options={[
            { value: "", label: t("allDisciplines") },
            { value: "photo", label: tShoot("disciplines.photo") },
            { value: "video", label: tShoot("disciplines.video") },
          ]}
        />

        <FilterList
          testId="filter-minrating"
          heading={t("minRating")}
          activeValue={minRatingValue}
          onSelect={(v) => setParam("minRating", v)}
          options={[
            { value: "", label: t("anyRating") },
            ...MIN_RATINGS.map((r) => ({
              value: String(r),
              label: `★ ${r}+`,
            })),
          ]}
        />

        <div className="flex flex-col border-t border-line pt-5">
          <FilterSwitch
            testId="filter-verified"
            label={t("verifiedOnly")}
            checked={verifiedOn}
            onChange={(v) => setParam("verified", v ? "1" : "")}
          />
          <FilterSwitch
            testId="filter-saved"
            label={t("savedOnly")}
            checked={savedOn}
            onChange={(v) => setParam("saved", v ? "1" : "")}
          />
        </div>

        <FilterList
          testId="filter-sort"
          heading={t("sortLabel")}
          activeValue={sortValue}
          onSelect={(v) => setParam("sort", v)}
          options={[
            { value: "rating", label: t("sortRating") },
            { value: "newest", label: t("sortNewest") },
            { value: "price", label: t("sortPriceAsc") },
          ]}
        />

        {hasFilters && (
          <button
            type="button"
            data-testid="filter-clear"
            onClick={clearAll}
            className="press min-h-11 self-start border border-line px-3.5 text-[13px] text-mute hover:border-ink hover:text-ink"
          >
            {t("clear")}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Desktop: vertical sidebar, always visible. */}
      <aside className="hidden lg:block">{renderSections()}</aside>

      {/* Mobile/tablet: collapsed above the grid, expands to the same lists. */}
      <details className="group border border-line lg:hidden">
        <summary className="label flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 text-ink [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            {t("filters")}
            {hasFilters && <span className="h-2 w-2 bg-accent" />}
          </span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <div className="border-t border-line px-4 py-6">{renderSections()}</div>
      </details>
    </>
  );
}
