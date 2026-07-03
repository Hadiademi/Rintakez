"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { highlightSegments } from "@/lib/search";
import {
  searchSuggestions,
  type SearchSuggestions,
} from "@/lib/actions/search";
import { SEARCH_MIN_CHARS } from "@/lib/validation/search";

const DEBOUNCE_MS = 250;
const EMPTY: SearchSuggestions = { photographers: [], shoots: [] };

type Item =
  | { kind: "photographer"; id: string; label: string; sub: string | null; href: string }
  | { kind: "shoot"; id: string; label: string; href: string };

/** Renders a label with the matched substring emphasized. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightSegments(text, query).map((seg, i) =>
        seg.match ? (
          <mark key={i} className="bg-transparent text-accent font-medium">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

/**
 * Editorial nav typeahead (desktop only — mounted inside the `lg:block` bar).
 * Debounced query over PUBLIC photographers + open shoots, grouped results with
 * headers, keyboard navigable (↓↑ Enter Esc). Enter with nothing highlighted
 * falls back to the browse page filtered by ?q (the "see all" path).
 */
export function NavSearch({ className = "" }: { className?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const listboxId = useId();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchSuggestions>(EMPTY);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  // Monotonic request id so a slow response can't clobber a newer one.
  const reqIdRef = useRef(0);

  const query = q.trim();

  // Flatten the two groups into a single keyboard-navigable list.
  const items = useMemo<Item[]>(() => {
    const photographers: Item[] = results.photographers.map((p) => ({
      kind: "photographer",
      id: p.id,
      label: p.display_name,
      sub: p.city,
      href: `/photographers/${p.id}`,
    }));
    const shoots: Item[] = results.shoots.map((s) => ({
      kind: "shoot",
      id: s.id,
      label: s.title,
      href: `/shoots/${s.id}`,
    }));
    return [...photographers, ...shoots];
  }, [results]);

  // Debounced suggestion fetch. Below the min-chars threshold we clear. All
  // state updates happen inside the timeout (not synchronously in the effect
  // body) to avoid cascading renders. A monotonic id drops stale responses.
  useEffect(() => {
    const id = ++reqIdRef.current;
    const handle = setTimeout(async () => {
      const data =
        query.length < SEARCH_MIN_CHARS ? EMPTY : await searchSuggestions(query);
      if (reqIdRef.current === id) {
        setResults(data);
        setActive(-1);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  /** The "see all" fallback — preserves the original route-to-browse behavior. */
  function seeAll() {
    setOpen(false);
    router.push(query ? `/shoots?q=${encodeURIComponent(query)}` : "/shoots");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length) {
        setOpen(true);
        setActive((i) => (i + 1) % items.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) {
        setOpen(true);
        setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && items[active]) go(items[active].href);
      else seeAll();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const showDropdown =
    open && query.length >= SEARCH_MIN_CHARS;
  const hasResults = items.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2.5 border border-line bg-surface px-3.5 py-2.5">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="shrink-0 text-mute-2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={
            active >= 0 ? `${listboxId}-opt-${active}` : undefined
          }
          autoComplete="off"
          className="w-full bg-transparent text-sm text-ink placeholder:text-mute-2 focus:outline-none"
        />
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto border border-line bg-surface shadow-lg"
        >
          {!hasResults ? (
            <p className="px-3.5 py-3 text-sm text-mute-2">
              {t("searchNoResults")}
            </p>
          ) : (
            <>
              {results.photographers.length > 0 && (
                <div>
                  <p className="label px-3.5 pt-3 pb-1.5 text-mute-2">
                    {t("photographers")}
                  </p>
                  {results.photographers.map((p, i) => {
                    const idx = i;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        id={`${listboxId}-opt-${idx}`}
                        role="option"
                        aria-selected={active === idx}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(`/photographers/${p.id}`)}
                        className={`press flex w-full min-h-11 flex-col items-start gap-0.5 px-3.5 py-2.5 text-left ${
                          active === idx ? "bg-chip" : ""
                        }`}
                      >
                        <span className="text-sm text-ink">
                          <Highlighted text={p.display_name} query={query} />
                        </span>
                        {p.city && (
                          <span className="text-xs text-mute-2">{p.city}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {results.shoots.length > 0 && (
                <div>
                  <p className="label px-3.5 pt-3 pb-1.5 text-mute-2">
                    {t("browseShoots")}
                  </p>
                  {results.shoots.map((s, i) => {
                    const idx = results.photographers.length + i;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        id={`${listboxId}-opt-${idx}`}
                        role="option"
                        aria-selected={active === idx}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(`/shoots/${s.id}`)}
                        className={`press flex w-full min-h-11 items-center px-3.5 py-2.5 text-left text-sm text-ink ${
                          active === idx ? "bg-chip" : ""
                        }`}
                      >
                        <Highlighted text={s.title} query={query} />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={seeAll}
            className="press flex w-full min-h-11 items-center border-t border-line px-3.5 py-2.5 text-left text-sm text-mute hover:text-ink"
          >
            {t("searchSeeAll")}
          </button>
        </div>
      )}
    </div>
  );
}
