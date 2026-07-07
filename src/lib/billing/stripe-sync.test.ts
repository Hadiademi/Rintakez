import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  mapStripeSubscription,
  shouldSkipWrite,
  detailsSyncValues,
  type NormalizedSub,
  type MappedSub,
  type ExistingSub,
} from "./stripe-sync";

// Pure logic — no mocks needed. priceIdToPlan (from ./plans) resolves prices
// via process.env.STRIPE_PRICE_<PLAN>_<INTERVAL>, so we stub the 6 env vars
// for the duration of this file and restore afterward.
const ENV_KEYS = [
  "STRIPE_PRICE_BASIC_MONTHLY",
  "STRIPE_PRICE_BASIC_YEARLY",
  "STRIPE_PRICE_STANDARD_MONTHLY",
  "STRIPE_PRICE_STANDARD_YEARLY",
  "STRIPE_PRICE_PREMIUM_MONTHLY",
  "STRIPE_PRICE_PREMIUM_YEARLY",
] as const;
const ORIGINAL_ENV: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];
  process.env.STRIPE_PRICE_BASIC_MONTHLY = "price_basic_monthly";
  process.env.STRIPE_PRICE_BASIC_YEARLY = "price_basic_yearly";
  process.env.STRIPE_PRICE_STANDARD_MONTHLY = "price_standard_monthly";
  process.env.STRIPE_PRICE_STANDARD_YEARLY = "price_standard_yearly";
  process.env.STRIPE_PRICE_PREMIUM_MONTHLY = "price_premium_monthly";
  process.env.STRIPE_PRICE_PREMIUM_YEARLY = "price_premium_yearly";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

function normalized(overrides: Partial<NormalizedSub> = {}): NormalizedSub {
  return {
    id: "sub_123",
    customerId: "cus_123",
    priceId: "price_standard_monthly",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEndUnix: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    userIdMeta: "user-1",
    ...overrides,
  };
}

describe("mapStripeSubscription", () => {
  it.each([
    ["active", "active"],
    ["trialing", "trialing"],
    ["past_due", "past_due"],
    ["canceled", "canceled"],
    ["unpaid", "canceled"],
  ] as const)("maps stripeStatus=%s to status=%s", (stripeStatus, status) => {
    const mapped = mapStripeSubscription(normalized({ stripeStatus }));
    expect(mapped).not.toBeNull();
    expect(mapped!.status).toBe(status);
    expect(mapped!.plan).toBe("standard");
  });

  it.each(["incomplete", "incomplete_expired", "paused"] as const)(
    "returns null (no-write) for stripeStatus=%s",
    (stripeStatus) => {
      expect(mapStripeSubscription(normalized({ stripeStatus }))).toBeNull();
    }
  );

  it("returns null when the priceId doesn't resolve to a paid plan (unknown price)", () => {
    expect(
      mapStripeSubscription(normalized({ priceId: "price_does_not_exist" }))
    ).toBeNull();
  });

  it("returns null when priceId is null", () => {
    expect(mapStripeSubscription(normalized({ priceId: null }))).toBeNull();
  });

  it("maps currentPeriodEndUnix to an ISO string", () => {
    const unix = 1893456000; // 2030-01-01T00:00:00Z
    const mapped = mapStripeSubscription(normalized({ currentPeriodEndUnix: unix }));
    expect(mapped!.currentPeriodEnd).toBe(new Date(unix * 1000).toISOString());
  });

  it("maps a null currentPeriodEndUnix to a null currentPeriodEnd", () => {
    const mapped = mapStripeSubscription(normalized({ currentPeriodEndUnix: null }));
    expect(mapped!.currentPeriodEnd).toBeNull();
  });

  it("carries through id, customerId and cancelAtPeriodEnd", () => {
    const mapped = mapStripeSubscription(
      normalized({ id: "sub_xyz", customerId: "cus_xyz", cancelAtPeriodEnd: true })
    );
    expect(mapped).toMatchObject({
      stripeSubscriptionId: "sub_xyz",
      stripeCustomerId: "cus_xyz",
      cancelAtPeriodEnd: true,
    });
  });
});

describe("shouldSkipWrite", () => {
  const now = new Date("2026-07-08T00:00:00.000Z");
  const incoming: MappedSub = {
    plan: "standard",
    status: "canceled",
    stripeSubscriptionId: "sub_new",
    stripeCustomerId: "cus_1",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };

  it("skips when an active admin comp outranks the incoming stripe event", () => {
    const existing: ExistingSub = {
      source: "admin_comp",
      comp_until: "2026-08-01T00:00:00.000Z", // future
      stripe_subscription_id: null,
    };
    expect(shouldSkipWrite(existing, incoming, now)).toBe(true);
  });

  it("does not skip when the admin comp has already expired", () => {
    const existing: ExistingSub = {
      source: "admin_comp",
      comp_until: "2026-01-01T00:00:00.000Z", // past
      stripe_subscription_id: null,
    };
    expect(shouldSkipWrite(existing, incoming, now)).toBe(false);
  });

  it("skips a stale cancel for an old stripe subscription id when a different sub is live", () => {
    const existing: ExistingSub = {
      source: "stripe",
      comp_until: null,
      stripe_subscription_id: "sub_old",
    };
    expect(shouldSkipWrite(existing, incoming, now)).toBe(true);
  });

  it("does not skip a cancel for the same (current) stripe subscription id", () => {
    const existing: ExistingSub = {
      source: "stripe",
      comp_until: null,
      stripe_subscription_id: "sub_new",
    };
    expect(shouldSkipWrite(existing, incoming, now)).toBe(false);
  });

  it("does not skip a non-cancel status update even for a different sub id", () => {
    const existing: ExistingSub = {
      source: "stripe",
      comp_until: null,
      stripe_subscription_id: "sub_old",
    };
    const activeIncoming: MappedSub = { ...incoming, status: "active" };
    expect(shouldSkipWrite(existing, activeIncoming, now)).toBe(false);
  });

  it("does not skip when there is no existing row", () => {
    expect(shouldSkipWrite(null, incoming, now)).toBe(false);
  });
});

describe("detailsSyncValues", () => {
  const now = new Date("2026-07-08T00:00:00.000Z");

  it("entitled active status with a future period end syncs plan + expiry", () => {
    const m: MappedSub = {
      plan: "premium",
      status: "active",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    };
    expect(detailsSyncValues(m, now)).toEqual({
      plan_tier: "premium",
      plan_expires_at: "2026-08-01T00:00:00.000Z",
    });
  });

  it("past_due is still entitled while the period end is in the future", () => {
    const m: MappedSub = {
      plan: "basic",
      status: "past_due",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    };
    expect(detailsSyncValues(m, now)).toEqual({
      plan_tier: "basic",
      plan_expires_at: "2026-08-01T00:00:00.000Z",
    });
  });

  it("canceled status is never entitled, regardless of period end", () => {
    const m: MappedSub = {
      plan: "standard",
      status: "canceled",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    };
    expect(detailsSyncValues(m, now)).toEqual({
      plan_tier: "free",
      plan_expires_at: null,
    });
  });

  it("an entitled status with a period end already in the past is not entitled", () => {
    const m: MappedSub = {
      plan: "standard",
      status: "active",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: "2026-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    };
    expect(detailsSyncValues(m, now)).toEqual({
      plan_tier: "free",
      plan_expires_at: null,
    });
  });

  it("a null currentPeriodEnd is never entitled", () => {
    const m: MappedSub = {
      plan: "standard",
      status: "active",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
    expect(detailsSyncValues(m, now)).toEqual({
      plan_tier: "free",
      plan_expires_at: null,
    });
  });
});
