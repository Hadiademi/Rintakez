"use client";

import { useTranslations } from "next-intl";
import { LINK_LABEL_MAX, MAX_LINKS, type LinkRow } from "@/lib/links";

// No `focus:outline-none`: the global focus ring stays visible for keyboard
// users, and the border darkening is an extra cue on top of it.
const fieldClass =
  "w-full min-w-0 border bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-mute-2 transition-colors focus:border-ink";

const EMPTY_ROW: LinkRow = { label: "", url: "" };

/** Id of a link row's URL input, so a form can move focus to the first
 *  invalid link after a failed save. */
export function linkUrlInputId(idPrefix: string, row: number): string {
  return `${idPrefix}-link-url-${row}`;
}

/**
 * Editable list of a photographer's public links: each row is an optional
 * name ("Sport", "Hochzeit") plus the link itself. Built for photographers who
 * keep a separate website and Instagram per field — the single website +
 * single Instagram fields could not express that.
 *
 * The URL input is `type="text"` with `inputMode="url"` on purpose: a
 * `type="url"` field would have the browser itself reject "www.example.ch" and
 * "@handle", the two shapes people actually type. Normalisation happens in the
 * schema (src/lib/links.ts).
 *
 * `errors` is keyed by row index; `onChange` reports which row changed so the
 * parent can clear that row's error, or "all" when rows shifted (a removal),
 * after which the old indices no longer match.
 */
export function LinksEditor({
  rows,
  onChange,
  errors,
  idPrefix,
}: {
  rows: LinkRow[];
  onChange: (rows: LinkRow[], changed: number | "all") => void;
  errors: Record<number, string>;
  idPrefix: string;
}) {
  const t = useTranslations("onboarding");
  const visible = rows.length > 0 ? rows : [EMPTY_ROW];

  function update(index: number, patch: Partial<LinkRow>) {
    onChange(
      visible.map((row, i) => (i === index ? { ...row, ...patch } : row)),
      index
    );
  }

  function remove(index: number) {
    const next = visible.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [EMPTY_ROW], "all");
  }

  const canAdd = visible.length < MAX_LINKS;

  return (
    <div className="flex flex-col gap-3">
      <p id={`${idPrefix}-links-hint`} className="max-w-prose text-[14px] text-mute">
        {t("linksHint")}
      </p>

      <ul className="flex flex-col gap-4" data-testid={`${idPrefix}-links`}>
        {visible.map((row, index) => {
          const error = errors[index];
          const errorId = `${idPrefix}-link-error-${index}`;
          const isEmpty = !row.label && !row.url;
          const showRemove = visible.length > 1 || !isEmpty;
          return (
            <li key={index} className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <input
                  id={`${idPrefix}-link-label-${index}`}
                  data-testid={`${idPrefix}-link-label-${index}`}
                  type="text"
                  value={row.label}
                  maxLength={LINK_LABEL_MAX}
                  onChange={(e) => update(index, { label: e.target.value })}
                  aria-label={`${t("linkLabel")} ${index + 1}`}
                  placeholder={t("linkLabelPlaceholder")}
                  className={`${fieldClass} border-line sm:w-44 sm:shrink-0`}
                />
                <div className="flex min-w-0 flex-1 gap-2">
                  <input
                    id={linkUrlInputId(idPrefix, index)}
                    data-testid={`${idPrefix}-link-url-${index}`}
                    type="text"
                    inputMode="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={row.url}
                    onChange={(e) => update(index, { url: e.target.value })}
                    aria-label={`${t("linkUrl")} ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : `${idPrefix}-links-hint`}
                    placeholder={t("linkUrlPlaceholder")}
                    className={`${fieldClass} ${error ? "border-accent" : "border-line"}`}
                  />
                  {showRemove ? (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      aria-label={`${t("removeLink")} ${index + 1}`}
                      className="press flex h-11 w-11 shrink-0 items-center justify-center border border-line text-mute hover:text-ink"
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  ) : null}
                </div>
              </div>
              {error ? (
                <p id={errorId} className="text-[13px] text-accent">
                  {error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {canAdd ? (
        <button
          type="button"
          data-testid={`${idPrefix}-add-link`}
          onClick={() => onChange([...visible, EMPTY_ROW], visible.length)}
          className="press w-fit border border-line px-4 py-2 text-sm text-mute hover:text-ink"
        >
          + {t("addLink")}
        </button>
      ) : (
        <p className="text-[13px] text-mute">{t("linksFull", { max: MAX_LINKS })}</p>
      )}
    </div>
  );
}
