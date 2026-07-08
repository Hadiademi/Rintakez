// Pure constants/types for the subscription plan model. ZERO imports — this
// file must stay framework-agnostic so it can be shared by web and (later) a
// native client without pulling in Supabase or Next.js.

export type Plan = "free" | "basic" | "standard" | "premium";
export type Interval = "monthly" | "yearly";
export type PaidPlan = "basic" | "standard" | "premium";

const PAID_PLANS: readonly PaidPlan[] = ["basic", "standard", "premium"];
const INTERVALS: readonly Interval[] = ["monthly", "yearly"];

export const TIER_RANK: Record<Plan, number> = {
  free: 0,
  basic: 1,
  standard: 2,
  premium: 3,
};

export const MONTHLY_BID_QUOTA: Record<Plan, number> = {
  free: 1,
  basic: 5,
  standard: 32,
  premium: Infinity,
};

export const PRICE_CHF_MONTHLY: Record<PaidPlan, number> = {
  basic: 59,
  standard: 119,
  premium: 229,
};

// Yearly pricing is not decided yet (price-agnostic placeholder). Every value
// is null until pricing is finalized, at which point they become numbers.
export const PRICE_CHF_YEARLY: Record<PaidPlan, number | null> = {
  basic: null,
  standard: null,
  premium: null,
};

// Stripe subscription statuses that still entitle the user to their plan
// (past_due keeps access during Stripe's dunning/retry window).
export const ENTITLED_STRIPE_STATUSES = ["active", "trialing", "past_due"] as const;

export const TRIAL_PERIOD_DAYS = 30;

/**
 * Resolves the Stripe Price id for a (plan, interval) pair from
 * `process.env.STRIPE_PRICE_<PLAN>_<INTERVAL>` (e.g. STRIPE_PRICE_STANDARD_MONTHLY).
 * Returns null for the free plan or when the env var is unset.
 */
export function stripePriceId(plan: Plan, interval: Interval): string | null {
  if (plan === "free") return null;
  const envVar = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[envVar] || null;
}

/** Reverse lookup: a Stripe Price id back to its Plan, over the 6 env-configured price ids. */
export function priceIdToPlan(priceId: string): Plan | null {
  for (const plan of PAID_PLANS) {
    for (const interval of INTERVALS) {
      if (stripePriceId(plan, interval) === priceId) return plan;
    }
  }
  return null;
}

/** True iff all 3 yearly Stripe Price env vars are set. */
export function hasYearlyPrices(): boolean {
  return PAID_PLANS.every((plan) => stripePriceId(plan, "yearly") !== null);
}

/**
 * Data-only descriptor for the pricing page (P4) to render — i18n KEY
 * strings, never translated text, so this file stays framework/locale-free.
 */
export type PlanFeatureRow = {
  plan: Plan;
  nameI18nKey: string;
  featureI18nKeys: readonly string[];
  monthlyBidQuota: number;
  priceChfMonthly: number | null;
  priceChfYearly: number | null;
};

export const PLAN_FEATURE_MATRIX: readonly PlanFeatureRow[] = [
  {
    plan: "free",
    nameI18nKey: "billing.plan.free.name",
    featureI18nKeys: [
      "billing.plan.free.feature.quota",
      "billing.plan.free.feature.profile",
      "billing.plan.free.feature.bell",
      "billing.plan.free.feature.browse",
    ],
    monthlyBidQuota: MONTHLY_BID_QUOTA.free,
    priceChfMonthly: null,
    priceChfYearly: null,
  },
  {
    plan: "basic",
    nameI18nKey: "billing.plan.basic.name",
    featureI18nKeys: [
      "billing.plan.basic.feature.everythingFree",
      "billing.plan.basic.feature.quota",
      "billing.plan.basic.feature.digest",
    ],
    monthlyBidQuota: MONTHLY_BID_QUOTA.basic,
    priceChfMonthly: PRICE_CHF_MONTHLY.basic,
    priceChfYearly: PRICE_CHF_YEARLY.basic,
  },
  {
    plan: "standard",
    nameI18nKey: "billing.plan.standard.name",
    featureI18nKeys: [
      "billing.plan.standard.feature.everythingBasic",
      "billing.plan.standard.feature.quota",
      "billing.plan.standard.feature.placement",
      "billing.plan.standard.feature.alerts",
      "billing.plan.standard.feature.dashboard",
    ],
    monthlyBidQuota: MONTHLY_BID_QUOTA.standard,
    priceChfMonthly: PRICE_CHF_MONTHLY.standard,
    priceChfYearly: PRICE_CHF_YEARLY.standard,
  },
  {
    plan: "premium",
    nameI18nKey: "billing.plan.premium.name",
    featureI18nKeys: [
      "billing.plan.premium.feature.everythingStandard",
      "billing.plan.premium.feature.quota",
      "billing.plan.premium.feature.placement",
      "billing.plan.premium.feature.badge",
      "billing.plan.premium.feature.benchmark",
      "billing.plan.premium.feature.spotlight",
    ],
    monthlyBidQuota: MONTHLY_BID_QUOTA.premium,
    priceChfMonthly: PRICE_CHF_MONTHLY.premium,
    priceChfYearly: PRICE_CHF_YEARLY.premium,
  },
];
