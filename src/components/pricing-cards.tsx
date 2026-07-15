"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  PLAN_FEATURE_MATRIX,
  type Interval,
  type PaidPlan,
  type Plan,
  type PlanFeatureRow,
} from "@/lib/billing/plans";
import { createCheckoutSession, createPortalSession } from "@/lib/actions/billing";
import { errorKey } from "@/lib/error-messages";
import { formatSwissDate } from "@/lib/format";

/**
 * Server-computed descriptor of who's looking at the pricing page — drives
 * the CTA matrix below. `currentPlan`/`expiresAt` are only set for the two
 * photographer-with-a-plan kinds.
 */
export type PricingViewer = {
  kind:
    | "anon"
    | "client"
    | "photographerFree"
    | "photographerEntitled"
    | "photographerComp";
  currentPlan?: Plan;
  expiresAt?: Date | null;
};

/** Crisp terracotta check used as the feature-list marker. */
function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="mt-[3px] shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3.2 3.2L13 4.5" />
    </svg>
  );
}

export function PricingCards({
  viewer,
  yearlyAvailable,
}: {
  viewer: PricingViewer;
  yearlyAvailable: boolean;
}) {
  // Scoped to the "billing" namespace — PLAN_FEATURE_MATRIX keys are the
  // fully-qualified "billing.xxx" strings, so `label()` strips the prefix
  // before looking them up through this scoped translator.
  const t = useTranslations("billing");
  const tErr = useTranslations("errors");
  const [interval, setInterval] = useState<Interval>("monthly");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function label(key: string): string {
    return t(key.replace(/^billing\./, ""));
  }

  function handleChoose(plan: PaidPlan) {
    setError(null);
    startTransition(async () => {
      const res = await createCheckoutSession(plan, interval);
      if (res.ok) {
        window.location.assign(res.url);
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  function handleManage() {
    setError(null);
    startTransition(async () => {
      const res = await createPortalSession();
      if (res.ok) {
        window.location.assign(res.url);
      } else {
        setError(tErr(errorKey(res.error)));
      }
    });
  }

  function renderPrice(row: PlanFeatureRow, dark: boolean) {
    // Free renders as "CHF 0 / month" — same layout as the paid cards, just
    // the literal number 0 (not the word "Free") per the approved mockup.
    const useYearly =
      interval === "yearly" && yearlyAvailable && row.priceChfYearly != null;
    const amount = row.plan === "free" ? 0 : useYearly ? row.priceChfYearly : row.priceChfMonthly;
    const suffix = useYearly ? t("pricing.perYear") : t("pricing.perMonth");
    const muted = dark ? "text-paper/60" : "text-mute";
    return (
      <p className="flex items-baseline gap-1.5">
        <span className={`text-sm font-medium ${muted}`}>CHF</span>
        <span
          className={`tabular text-5xl font-semibold tracking-tight ${dark ? "text-paper" : "text-ink"}`}
        >
          {amount}
        </span>
        <span className={`text-sm ${muted}`}>{suffix}</span>
      </p>
    );
  }

  function renderCta(row: PlanFeatureRow, dark: boolean) {
    const planName = label(row.nameI18nKey);
    const isFree = row.plan === "free";

    // Primary buttons: terracotta on the dark/highlighted card, ink (black)
    // elsewhere. Outlined "current plan" buttons flip their border/text so
    // they stay legible against the dark card's ink background.
    const primaryClass = dark
      ? "bg-accent text-paper"
      : "bg-ink text-paper";
    const outlineClass = dark
      ? "border border-white/25 text-paper"
      : "border border-line text-ink";

    if (viewer.kind === "anon") {
      return (
        <Link
          href="/register"
          className={`press block w-full px-4 py-3 text-center label ${primaryClass}`}
        >
          {t("pricing.ctaRegister")}
        </Link>
      );
    }

    if (viewer.kind === "client") {
      return (
        <p className={`text-[15px] ${dark ? "text-paper/70" : "text-mute"}`}>
          {t("pricing.clientNote")}
        </p>
      );
    }

    if (viewer.kind === "photographerFree") {
      if (isFree) {
        return (
          <p className={`label ${dark ? "text-paper/70" : "text-mute"}`}>
            {t("pricing.ctaCurrent")}
          </p>
        );
      }
      return (
        <button
          type="button"
          onClick={() => handleChoose(row.plan as PaidPlan)}
          disabled={isPending}
          className={`press w-full px-4 py-3 label disabled:opacity-50 ${primaryClass}`}
        >
          {t("pricing.ctaChoose", { plan: planName })}
        </button>
      );
    }

    const isCurrentPlan = viewer.currentPlan === row.plan;

    if (viewer.kind === "photographerEntitled") {
      // Every paid card manages through the Stripe Customer Portal — it
      // natively handles plan switching/proration, and P3's checkout action
      // unconditionally rejects `already_subscribed` regardless of the
      // target plan, so a "Choose" button here would always dead-end.
      if (isFree) return null;
      if (isCurrentPlan) {
        return (
          <div className="space-y-2">
            <p className={`label ${dark ? "text-paper/70" : "text-mute"}`}>
              {t("pricing.ctaCurrent")}
            </p>
            <button
              type="button"
              onClick={handleManage}
              disabled={isPending}
              className={`press w-full px-4 py-3 label disabled:opacity-50 ${outlineClass}`}
            >
              {t("pricing.ctaManage")}
            </button>
          </div>
        );
      }
      return (
        <button
          type="button"
          onClick={handleManage}
          disabled={isPending}
          className={`press w-full px-4 py-3 label disabled:opacity-50 ${outlineClass}`}
        >
          {t("pricing.ctaManage")}
        </button>
      );
    }

    // photographerComp: a comped account has no Stripe customer, so the
    // portal isn't applicable, and P3's checkout action unconditionally
    // rejects `comp_active` for every plan while the comp is active. Show
    // info only — no actionable button — on every card except the comped
    // plan itself, which shows the gift-until note.
    if (isCurrentPlan) {
      return (
        <p className="text-[15px] text-accent">
          {t("pricing.compNote", {
            date: viewer.expiresAt
              ? formatSwissDate(viewer.expiresAt.toISOString().slice(0, 10))
              : "",
          })}
        </p>
      );
    }
    return null;
  }

  return (
    <div className="space-y-8">
      {yearlyAvailable && (
        <div className="flex justify-center">
          <div role="group" className="inline-flex border border-line">
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              aria-pressed={interval === "monthly"}
              className={`label press px-4 py-3 ${
                interval === "monthly" ? "bg-ink text-paper" : "text-ink"
              }`}
            >
              {t("pricing.intervalMonthly")}
            </button>
            <button
              type="button"
              onClick={() => setInterval("yearly")}
              aria-pressed={interval === "yearly"}
              className={`label press px-4 py-3 ${
                interval === "yearly" ? "bg-ink text-paper" : "text-ink"
              }`}
            >
              {t("pricing.intervalYearly")}
            </button>
          </div>
        </div>
      )}

      {/* Joined cards: one outer border with hairline dividers between columns
          (no gaps), matching the approved mockup. The Standard card fills its
          cell edge-to-edge with a terracotta top accent so it still pops. */}
      <div className="grid grid-cols-1 divide-y divide-line border border-line lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {PLAN_FEATURE_MATRIX.map((row) => {
          const dark = row.plan === "standard";
          return (
            <section
              key={row.plan}
              data-testid={`pricing-card-${row.plan}`}
              className={`relative flex h-full flex-col p-6 ${
                dark
                  ? "border-t-2 border-accent bg-ink text-paper"
                  : "bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className={`text-xl font-bold ${dark ? "text-paper" : "text-ink"}`}>
                  {label(row.nameI18nKey)}
                </p>
                {dark && (
                  <span className="label shrink-0 bg-accent px-2.5 py-1 text-paper">
                    {t("pricing.mostPopular")}
                  </span>
                )}
              </div>

              <p className={`mt-1.5 text-[13px] ${dark ? "text-paper/60" : "text-mute"}`}>
                {label(`billing.plan.${row.plan}.tagline`)}
              </p>

              <div className="mt-6">{renderPrice(row, dark)}</div>

              <div className="mt-6">{renderCta(row, dark)}</div>

              <ul
                className={`mt-6 flex-1 space-y-3 border-t pt-6 ${
                  dark ? "border-white/15" : "border-line"
                }`}
              >
                {row.featureI18nKeys.map((key) => (
                  <li
                    key={key}
                    className={`flex items-start gap-2.5 text-[14px] leading-snug ${
                      dark ? "text-paper" : "text-ink"
                    }`}
                  >
                    <Check />
                    <span>{label(key)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {error ? <p className="text-center text-sm text-accent">{error}</p> : null}
    </div>
  );
}
