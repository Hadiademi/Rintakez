import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ENTITLED_STRIPE_STATUSES,
  MONTHLY_BID_QUOTA,
  PLAN_FEATURE_MATRIX,
  PRICE_CHF_MONTHLY,
  PRICE_CHF_YEARLY,
  TIER_RANK,
  TRIAL_PERIOD_DAYS,
  hasYearlyPrices,
  priceIdToPlan,
  stripePriceId,
} from "./plans";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("TIER_RANK", () => {
  it("orders the tiers free < basic < standard < premium", () => {
    expect(TIER_RANK.free).toBeLessThan(TIER_RANK.basic);
    expect(TIER_RANK.basic).toBeLessThan(TIER_RANK.standard);
    expect(TIER_RANK.standard).toBeLessThan(TIER_RANK.premium);
  });

  it("has the exact expected ranks", () => {
    expect(TIER_RANK).toEqual({ free: 0, basic: 1, standard: 2, premium: 3 });
  });
});

describe("MONTHLY_BID_QUOTA", () => {
  it("has the exact quota table", () => {
    expect(MONTHLY_BID_QUOTA.free).toBe(1);
    expect(MONTHLY_BID_QUOTA.basic).toBe(5);
    expect(MONTHLY_BID_QUOTA.standard).toBe(32);
    expect(MONTHLY_BID_QUOTA.premium).toBe(Infinity);
  });
});

describe("prices", () => {
  it("has the exact monthly CHF prices", () => {
    expect(PRICE_CHF_MONTHLY).toEqual({ basic: 59, standard: 119, premium: 229 });
  });

  it("has all-null yearly prices (TBD, price-agnostic)", () => {
    expect(PRICE_CHF_YEARLY).toEqual({ basic: null, standard: null, premium: null });
  });
});

describe("ENTITLED_STRIPE_STATUSES / TRIAL_PERIOD_DAYS", () => {
  it("lists exactly active, trialing, past_due", () => {
    expect(ENTITLED_STRIPE_STATUSES).toEqual(["active", "trialing", "past_due"]);
  });

  it("trial period is 30 days", () => {
    expect(TRIAL_PERIOD_DAYS).toBe(30);
  });
});

describe("stripePriceId", () => {
  it("returns null for the free plan regardless of env", () => {
    vi.stubEnv("STRIPE_PRICE_FREE_MONTHLY", "price_should_never_be_read");
    expect(stripePriceId("free", "monthly")).toBeNull();
  });

  it("reads the env var STRIPE_PRICE_<PLAN>_<INTERVAL> when set", () => {
    vi.stubEnv("STRIPE_PRICE_STANDARD_MONTHLY", "price_standard_monthly_123");
    expect(stripePriceId("standard", "monthly")).toBe("price_standard_monthly_123");
  });

  it("returns null when the env var is unset", () => {
    expect(stripePriceId("premium", "yearly")).toBeNull();
  });

  it("distinguishes monthly vs yearly for the same plan", () => {
    vi.stubEnv("STRIPE_PRICE_BASIC_MONTHLY", "price_basic_m");
    vi.stubEnv("STRIPE_PRICE_BASIC_YEARLY", "price_basic_y");
    expect(stripePriceId("basic", "monthly")).toBe("price_basic_m");
    expect(stripePriceId("basic", "yearly")).toBe("price_basic_y");
  });
});

describe("priceIdToPlan", () => {
  it("round-trips a known price id back to its plan", () => {
    vi.stubEnv("STRIPE_PRICE_STANDARD_MONTHLY", "price_standard_monthly_123");
    expect(priceIdToPlan("price_standard_monthly_123")).toBe("standard");
  });

  it("round-trips a yearly price id too", () => {
    vi.stubEnv("STRIPE_PRICE_PREMIUM_YEARLY", "price_premium_yearly_999");
    expect(priceIdToPlan("price_premium_yearly_999")).toBe("premium");
  });

  it("returns null for an unrecognized price id", () => {
    vi.stubEnv("STRIPE_PRICE_BASIC_MONTHLY", "price_basic_m");
    expect(priceIdToPlan("price_totally_unknown")).toBeNull();
  });
});

describe("PLAN_FEATURE_MATRIX", () => {
  it("has the exact curated feature key lists per plan (P4 pricing page)", () => {
    const byPlan = Object.fromEntries(
      PLAN_FEATURE_MATRIX.map((row) => [row.plan, row.featureI18nKeys])
    );
    expect(byPlan.free).toEqual([
      "billing.plan.free.feature.quota",
      "billing.plan.free.feature.profile",
      "billing.plan.free.feature.bell",
      "billing.plan.free.feature.browse",
    ]);
    expect(byPlan.basic).toEqual([
      "billing.plan.basic.feature.everythingFree",
      "billing.plan.basic.feature.quota",
      "billing.plan.basic.feature.digest",
    ]);
    expect(byPlan.standard).toEqual([
      "billing.plan.standard.feature.everythingBasic",
      "billing.plan.standard.feature.quota",
      "billing.plan.standard.feature.placement",
      "billing.plan.standard.feature.alerts",
      "billing.plan.standard.feature.dashboard",
    ]);
    expect(byPlan.premium).toEqual([
      "billing.plan.premium.feature.everythingStandard",
      "billing.plan.premium.feature.quota",
      "billing.plan.premium.feature.placement",
      "billing.plan.premium.feature.badge",
      "billing.plan.premium.feature.benchmark",
      "billing.plan.premium.feature.spotlight",
    ]);
  });

  it("orders rows free, basic, standard, premium and keeps name/price wiring intact", () => {
    expect(PLAN_FEATURE_MATRIX.map((r) => r.plan)).toEqual([
      "free",
      "basic",
      "standard",
      "premium",
    ]);
    for (const row of PLAN_FEATURE_MATRIX) {
      expect(row.nameI18nKey).toBe(`billing.plan.${row.plan}.name`);
      expect(row.monthlyBidQuota).toBe(MONTHLY_BID_QUOTA[row.plan]);
    }
  });
});

describe("hasYearlyPrices", () => {
  it("is false when none of the yearly env vars are set", () => {
    expect(hasYearlyPrices()).toBe(false);
  });

  it("is false when only some yearly env vars are set", () => {
    vi.stubEnv("STRIPE_PRICE_BASIC_YEARLY", "price_basic_y");
    vi.stubEnv("STRIPE_PRICE_STANDARD_YEARLY", "price_standard_y");
    expect(hasYearlyPrices()).toBe(false);
  });

  it("is true when all 3 yearly env vars are set", () => {
    vi.stubEnv("STRIPE_PRICE_BASIC_YEARLY", "price_basic_y");
    vi.stubEnv("STRIPE_PRICE_STANDARD_YEARLY", "price_standard_y");
    vi.stubEnv("STRIPE_PRICE_PREMIUM_YEARLY", "price_premium_y");
    expect(hasYearlyPrices()).toBe(true);
  });
});
