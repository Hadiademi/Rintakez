"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProfileCompleteness } from "@/lib/profile-completeness";

/**
 * Profile-completeness card for photographers. Shows a percent + accent progress
 * bar and the top-3 missing items as deep-links into their edit surface.
 *
 * Renders nothing at 100% (the profile is complete, so the nudge is noise).
 * Photographer-only — clients have no equivalent profile.
 */
export function ProfileChecklist({ result }: { result: ProfileCompleteness }) {
  const t = useTranslations("checklist");

  // Auto-hide once the profile is fully complete.
  if (result.score >= 100) return null;

  const missing = result.items.filter((i) => !i.done).slice(0, 3);

  return (
    <section
      aria-label={t("title")}
      className="border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {t("title")}
        </h2>
        <span className="tabular text-lg font-semibold text-ink">
          {result.score}%
        </span>
      </div>

      <p className="mt-1 text-sm leading-relaxed text-mute">{t("hint")}</p>

      {/* Progress track (bg-chip) with an accent fill. */}
      <div
        role="progressbar"
        aria-valuenow={result.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("progressLabel", { percent: result.score })}
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-chip"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${result.score}%` }}
        />
      </div>

      {missing.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {missing.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="press flex min-h-11 items-center justify-between gap-3 py-2.5 text-[15px] text-ink hover:text-accent"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="inline-block size-4 shrink-0 rounded-full border border-line-strong"
                  />
                  {t(`item.${item.key}`)}
                </span>
                <span className="tabular shrink-0 text-sm text-mute">
                  +{Math.round(item.weight - item.points)}
                  <span className="sr-only">%</span>
                  <svg
                    className="ml-1.5 inline-block"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
