"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { SHOOT_TYPES, CANTONS } from "@/lib/validation/photographer";

const MIN_RATINGS = [3, 4, 4.5] as const;

/** The actual filters (excluding sort, which is ordering) — drives the badge
 * on the mobile trigger and the reset affordances. */
const FILTER_KEYS = [
  "type",
  "canton",
  "discipline",
  "minRating",
  "saved",
  "verified",
  "q",
] as const;

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

/**
 * The filter controls themselves, decoupled from WHERE their state lives:
 * the desktop sidebar reads/writes the URL directly (instant apply), while
 * the mobile sheet passes a local draft (batched — nothing navigates until
 * "Apply"). `liveSearch` makes the name search a controlled input writing on
 * every keystroke (draft mode); the URL-backed sidebar keeps the submit form
 * so typing doesn't navigate per key.
 */
function FilterSections({
  get,
  set,
  liveSearch = false,
  onClear,
  showClear,
}: {
  get: (key: string) => string;
  set: (key: string, value: string) => void;
  liveSearch?: boolean;
  onClear?: () => void;
  showClear?: boolean;
}) {
  const t = useTranslations("directory");
  const tShoot = useTranslations("shoot");

  return (
    <div className="flex flex-col gap-8">
      {liveSearch ? (
        <input
          name="q"
          type="search"
          value={get("q")}
          onChange={(e) => set("q", e.target.value)}
          placeholder={t("searchName")}
          data-testid="filter-search"
          className="min-h-11 w-full border border-line bg-surface px-3.5 text-[14px] text-ink placeholder:text-mute-2 focus:border-ink focus:outline-none"
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("q");
            set("q", typeof v === "string" ? v.trim() : "");
          }}
          className="flex gap-2"
        >
          <input
            key={get("q")}
            name="q"
            type="search"
            defaultValue={get("q")}
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
      )}

      <FilterList
        testId="filter-specialty"
        heading={t("filterSpecialty")}
        activeValue={get("type")}
        onSelect={(v) => set("type", v)}
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
        activeValue={get("canton")}
        onSelect={(v) => set("canton", v)}
        scroll
        options={[
          { value: "", label: t("allCantons") },
          ...CANTONS.map((c) => ({ value: c, label: c })),
        ]}
      />

      <FilterList
        testId="filter-discipline"
        heading={t("filterDiscipline")}
        activeValue={get("discipline")}
        onSelect={(v) => set("discipline", v)}
        options={[
          { value: "", label: t("allDisciplines") },
          { value: "photo", label: tShoot("disciplines.photo") },
          { value: "video", label: tShoot("disciplines.video") },
        ]}
      />

      <FilterList
        testId="filter-minrating"
        heading={t("minRating")}
        activeValue={get("minRating")}
        onSelect={(v) => set("minRating", v)}
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
          checked={!!get("verified")}
          onChange={(v) => set("verified", v ? "1" : "")}
        />
        <FilterSwitch
          testId="filter-saved"
          label={t("savedOnly")}
          checked={!!get("saved")}
          onChange={(v) => set("saved", v ? "1" : "")}
        />
      </div>

      <FilterList
        testId="filter-sort"
        heading={t("sortLabel")}
        activeValue={get("sort") || "rating"}
        onSelect={(v) => set("sort", v)}
        options={[
          { value: "rating", label: t("sortRating") },
          { value: "newest", label: t("sortNewest") },
          { value: "price", label: t("sortPriceAsc") },
        ]}
      />

      {showClear && onClear && (
        <button
          type="button"
          data-testid="filter-clear"
          onClick={onClear}
          className="press min-h-11 self-start border border-line px-3.5 text-[13px] text-mute hover:border-ink hover:text-ink"
        >
          {t("clear")}
        </button>
      )}
    </div>
  );
}

export function PhotographerFilters() {
  const t = useTranslations("directory");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // ── Desktop sidebar: URL-backed, instant apply. scroll:false keeps the
  // viewer's place in the results instead of jumping to the page top.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // any filter change returns to the first page
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;
  const hasFilters = activeCount > 0 || !!params.get("sort");

  function clearAll() {
    router.push(pathname, { scroll: false });
  }

  // ── Mobile sheet: a local DRAFT of the params. Nothing navigates while the
  // sheet is open — the user stacks as many filters as they want, sees the
  // live result count on the Apply button, then commits everything in ONE
  // navigation. (The old inline <details> applied per tap; each tap re-rendered
  // the page and threw the scroll position back to the top — the exact UX bug
  // this sheet removes.)
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [count, setCount] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  function openSheet() {
    const init: Record<string, string> = {};
    for (const k of [...FILTER_KEYS, "sort"]) init[k] = params.get(k) ?? "";
    setDraft(init);
    setOpen(true);
  }

  // Live count for the Apply button, debounced; stale responses are ignored
  // via AbortController. Draft-only (sheet open) — the sidebar never fetches.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const qs = new URLSearchParams();
      for (const k of FILTER_KEYS) {
        if (draft[k]) qs.set(k, draft[k]);
      }
      try {
        const res = await fetch(`/api/directory/count?${qs.toString()}`, {
          signal: controller.signal,
        });
        const body = (await res.json()) as { count: number | null };
        setCount(typeof body.count === "number" ? body.count : null);
      } catch {
        setCount(null); // degrade to a plain "Apply" label
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, draft]);

  // While the sheet is open: lock body scroll, close on Escape, move focus in.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const draftActive = useMemo(
    () => FILTER_KEYS.some((k) => draft[k]),
    [draft]
  );

  function applyDraft() {
    const next = new URLSearchParams();
    for (const k of [...FILTER_KEYS, "sort"]) {
      if (draft[k]) next.set(k, k === "q" ? draft[k].trim() : draft[k]);
    }
    const qs = next.toString();
    setOpen(false);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
      {/* Desktop: vertical sidebar, always visible, instant apply. */}
      <aside className="hidden lg:block">
        <FilterSections
          get={(k) => params.get(k) ?? ""}
          set={setParam}
          showClear={hasFilters}
          onClear={clearAll}
        />
      </aside>

      {/* Mobile/tablet trigger: opens the sheet; badge = active filter count. */}
      <button
        type="button"
        data-testid="filter-sheet-open"
        onClick={openSheet}
        className="press flex min-h-11 w-full items-center justify-between border border-line px-4 py-3 lg:hidden"
      >
        <span className="label inline-flex items-center gap-2 text-ink">
          {t("filters")}
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center bg-accent px-1 text-[11px] font-semibold text-paper">
              {activeCount}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-mute">
          ⌄
        </span>
      </button>

      {/* Bottom sheet: backdrop + panel pinned to the bottom edge. The list
          scrolls INSIDE the panel; the page behind never moves, so picking
          five filters in a row needs zero re-scrolling. */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("filters")}
        >
          {/* Backdrop: a real button so tap-outside-to-dismiss is a11y-clean;
              kept out of the tab order (Escape + the X cover keyboard users). */}
          <button
            type="button"
            data-testid="filter-sheet-backdrop"
            tabIndex={-1}
            aria-label={tCommon("close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-ink/40"
          />
          <div
            data-testid="filter-sheet"
            className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col border-t border-line bg-paper"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="label text-ink">{t("filters")}</span>
              <button
                ref={closeRef}
                type="button"
                data-testid="filter-sheet-close"
                onClick={() => setOpen(false)}
                aria-label={tCommon("close")}
                className="press flex h-9 w-9 items-center justify-center text-mute hover:text-ink"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <FilterSections
                get={(k) => draft[k] ?? ""}
                set={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
                liveSearch
              />
            </div>

            <div
              className="flex items-center gap-3 border-t border-line bg-surface px-4 py-3"
              style={{
                paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
              }}
            >
              {draftActive && (
                <button
                  type="button"
                  data-testid="filter-sheet-reset"
                  onClick={() =>
                    setDraft((d) => {
                      const next = { ...d };
                      for (const k of FILTER_KEYS) next[k] = "";
                      return next;
                    })
                  }
                  className="press min-h-11 shrink-0 border border-line px-4 text-[14px] text-mute hover:border-ink hover:text-ink"
                >
                  {t("clear")}
                </button>
              )}
              <button
                type="button"
                data-testid="filter-sheet-apply"
                onClick={applyDraft}
                className="press min-h-11 flex-1 bg-ink px-4 text-[14px] font-medium text-paper"
              >
                {count === null
                  ? t("apply")
                  : t("showResults", { count })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
