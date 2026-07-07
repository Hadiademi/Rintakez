import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// createCheckoutSession/createPortalSession resolve getProfile()/getStripe()/
// createAdminClient()/rateLimit() via module imports with no injection seam,
// so fake each module they pull from — same style as
// src/lib/actions/admin.test.ts / src/lib/email.test.ts.
const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }));
const { getStripe } = vi.hoisted(() => ({ getStripe: vi.fn() }));
const { createAdminClient } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));
const { rateLimit } = vi.hoisted(() => ({ rateLimit: vi.fn() }));
const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getProfile }));
vi.mock("@/lib/stripe", () => ({ getStripe }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/observability", () => ({ captureError }));

import { createCheckoutSession, createPortalSession } from "./billing";

const PHOTOGRAPHER = {
  id: "photog-1",
  role: "photographer",
  locale: "de",
};

type QueryResult = { data: unknown; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "maybeSingle"]) {
    builder[method] = vi.fn(chain);
  }
  builder.then = ((onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled)) as PromiseLike<QueryResult>["then"];
  return builder as unknown as PromiseLike<QueryResult> & Record<string, unknown>;
}

function fakeAdmin(subscriptionRow?: QueryResult) {
  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      return {
        select: vi.fn(() =>
          makeQueryBuilder(subscriptionRow ?? { data: null, error: null })
        ),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from };
}

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

  getProfile.mockReset();
  getStripe.mockReset();
  createAdminClient.mockReset();
  rateLimit.mockReset();
  captureError.mockReset();

  getProfile.mockResolvedValue(PHOTOGRAPHER);
  rateLimit.mockResolvedValue(true);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL_ENV[key];
  }
});

describe("createCheckoutSession", () => {
  it("returns unauthorized when there is no session", async () => {
    getProfile.mockResolvedValue(null);
    const result = await createCheckoutSession("standard", "monthly");
    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns forbidden for a non-photographer", async () => {
    getProfile.mockResolvedValue({ id: "client-1", role: "client", locale: "de" });
    const result = await createCheckoutSession("standard", "monthly");
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns limit_reached when the rate limit is exceeded", async () => {
    rateLimit.mockResolvedValue(false);
    const result = await createCheckoutSession("standard", "monthly");
    expect(result).toEqual({ ok: false, error: "limit_reached" });
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns stripe_not_configured when getStripe() is null", async () => {
    getStripe.mockReturnValue(null);
    const result = await createCheckoutSession("standard", "monthly");
    expect(result).toEqual({ ok: false, error: "stripe_not_configured" });
  });

  it("returns generic when createAdminClient() is null", async () => {
    getStripe.mockReturnValue({ checkout: { sessions: { create: vi.fn() } } });
    createAdminClient.mockReturnValue(null);
    const result = await createCheckoutSession("standard", "monthly");
    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("returns comp_active for an active admin comp (no Stripe call)", async () => {
    const create = vi.fn();
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    createAdminClient.mockReturnValue(
      fakeAdmin({
        data: {
          source: "admin_comp",
          status: "comp",
          comp_until: future,
          current_period_end: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        },
        error: null,
      })
    );

    const result = await createCheckoutSession("standard", "monthly");

    expect(result).toEqual({ ok: false, error: "comp_active" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns already_subscribed for an already-entitled stripe subscription", async () => {
    const create = vi.fn();
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    createAdminClient.mockReturnValue(
      fakeAdmin({
        data: {
          source: "stripe",
          status: "active",
          comp_until: null,
          current_period_end: future,
          stripe_customer_id: "cus_1",
          stripe_subscription_id: "sub_1",
        },
        error: null,
      })
    );

    const result = await createCheckoutSession("standard", "monthly");

    expect(result).toEqual({ ok: false, error: "already_subscribed" });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns price_unavailable when the price env var is unset", async () => {
    delete process.env.STRIPE_PRICE_STANDARD_MONTHLY;
    const create = vi.fn();
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    createAdminClient.mockReturnValue(fakeAdmin());

    const result = await createCheckoutSession("standard", "monthly");

    expect(result).toEqual({ ok: false, error: "price_unavailable" });
    expect(create).not.toHaveBeenCalled();
  });

  it("happy path (no prior stripe sub): includes trial_period_days and returns the session url", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session_1" });
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    createAdminClient.mockReturnValue(fakeAdmin());

    const result = await createCheckoutSession("standard", "monthly");

    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.com/session_1" });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0];
    expect(params).toMatchObject({
      mode: "subscription",
      line_items: [{ price: "price_standard_monthly", quantity: 1 }],
      client_reference_id: PHOTOGRAPHER.id,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      subscription_data: {
        metadata: { user_id: PHOTOGRAPHER.id },
        trial_period_days: 30,
      },
      metadata: { user_id: PHOTOGRAPHER.id },
    });
    expect(params.customer).toBeUndefined();
    expect(options).toEqual({
      idempotencyKey: `checkout:${PHOTOGRAPHER.id}:standard:monthly`,
    });
  });

  it("happy path (has a prior stripe subscription id): omits trial_period_days and passes the existing customer", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/session_2" });
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    createAdminClient.mockReturnValue(
      fakeAdmin({
        data: {
          source: "stripe",
          status: "canceled",
          comp_until: null,
          current_period_end: "2020-01-01T00:00:00.000Z",
          stripe_customer_id: "cus_old",
          stripe_subscription_id: "sub_old",
        },
        error: null,
      })
    );

    const result = await createCheckoutSession("premium", "monthly");

    expect(result).toEqual({ ok: true, url: "https://checkout.stripe.com/session_2" });
    const [params] = create.mock.calls[0];
    expect(params.customer).toBe("cus_old");
    expect(params.subscription_data.trial_period_days).toBeUndefined();
  });

  it("returns generic when the created session has no url", async () => {
    const create = vi.fn().mockResolvedValue({ url: null });
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    createAdminClient.mockReturnValue(fakeAdmin());

    const result = await createCheckoutSession("standard", "monthly");

    expect(result).toEqual({ ok: false, error: "generic" });
  });

  it("returns generic and captures the error when the Stripe call throws", async () => {
    const create = vi.fn().mockRejectedValue(new Error("stripe down"));
    getStripe.mockReturnValue({ checkout: { sessions: { create } } });
    createAdminClient.mockReturnValue(fakeAdmin());

    const result = await createCheckoutSession("standard", "monthly");

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});

describe("createPortalSession", () => {
  it("returns unauthorized when there is no session", async () => {
    getProfile.mockResolvedValue(null);
    const result = await createPortalSession();
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns forbidden for a non-photographer", async () => {
    getProfile.mockResolvedValue({ id: "client-1", role: "client", locale: "de" });
    const result = await createPortalSession();
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("returns stripe_not_configured when getStripe() is null", async () => {
    getStripe.mockReturnValue(null);
    const result = await createPortalSession();
    expect(result).toEqual({ ok: false, error: "stripe_not_configured" });
  });

  it("returns no_customer when the user has no stripe_customer_id", async () => {
    getStripe.mockReturnValue({ billingPortal: { sessions: { create: vi.fn() } } });
    createAdminClient.mockReturnValue(
      fakeAdmin({ data: { stripe_customer_id: null }, error: null })
    );

    const result = await createPortalSession();

    expect(result).toEqual({ ok: false, error: "no_customer" });
  });

  it("happy path: returns the portal session url", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/session_1" });
    getStripe.mockReturnValue({ billingPortal: { sessions: { create } } });
    createAdminClient.mockReturnValue(
      fakeAdmin({ data: { stripe_customer_id: "cus_1" }, error: null })
    );

    const result = await createPortalSession();

    expect(result).toEqual({ ok: true, url: "https://billing.stripe.com/session_1" });
    expect(create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: `http://localhost:3000/de/profile#billing`,
    });
  });

  it("returns generic and captures the error when the Stripe call throws", async () => {
    const create = vi.fn().mockRejectedValue(new Error("stripe down"));
    getStripe.mockReturnValue({ billingPortal: { sessions: { create } } });
    createAdminClient.mockReturnValue(
      fakeAdmin({ data: { stripe_customer_id: "cus_1" }, error: null })
    );

    const result = await createPortalSession();

    expect(result).toEqual({ ok: false, error: "generic" });
    expect(captureError).toHaveBeenCalledTimes(1);
  });
});
