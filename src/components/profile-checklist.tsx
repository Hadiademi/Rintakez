"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMoment } from "@/components/ui/moment";
import {
  browserMomentStorage,
  markMomentSeen,
  shouldCelebrateCompletion,
} from "@/lib/moment-once";
import { Link } from "@/i18n/navigation";
import type { ProfileCompleteness } from "@/lib/profile-completeness";

/**
 * Profile-completeness card for photographers. Shows a percent + accent progress
 * bar and the top-3 missing items as deep-links into their edit surface.
 *
 * Renders nothing at 100% (the profile is complete, so the nudge is noise).
 * Photographer-only — clients have no equivalent profile.
 */
export function ProfileChecklist({
  result,
  userId,
}: {
  result: ProfileCompleteness;
  userId: string;
}) {
  const t = useTranslations("checklist");

  // Auto-hide once the profile is fully complete — after celebrating the
  // moment it got there (see CompletionMoment).
  if (result.score >= 100) {
    return <CompletionMoment userId={userId} score={result.score} />;
  }

  const missing = result.items.filter((i) => !i.done).slice(0, 3);

  return (
    <section
      aria-label={t("title")}
      className="border border-line bg-surface p-5 sm:p-6"
    >
      <CompletionMoment userId={userId} score={result.score} />
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

/**
 * Celebrates the step to 100% once, on a device that saw the profile
 * incomplete (so long-complete profiles never get a surprise party). Mounted
 * on both sides of the threshold: below 100 it only records that fact.
 */
function CompletionMoment({ userId, score }: { userId: string; score: number }) {
  const tm = useTranslations("moments.profileComplete");
  const tMoments = useTranslations("moments");
  const { celebrate } = useMoment();
  useEffect(() => {
    const storage = browserMomentStorage();
    if (!shouldCelebrateCompletion(storage, userId, score)) return;
    markMomentSeen(storage, `profile-complete:${userId}`);
    celebrate({
      eyebrow: tm("eyebrow"),
      title: tm("title"),
      body: tm("body"),
      primary: { label: tm("view"), href: `/photographers/${userId}` },
      secondary: { label: tMoments("close") },
    });
    // tm/tMoments are stable per locale; the threshold is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, score, celebrate]);
  return null;
}
