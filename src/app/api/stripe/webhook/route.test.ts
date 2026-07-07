import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";

// The webhook route resolves getStripe()/createAdminClient()/captureError()/
// revalidateTag() via module imports with no injection seam, so fake each
// module it pulls from — same vi.hoisted + vi.mock style as
// src/lib/actions/admin.test.ts / src/lib/email.test.ts. Signature
// verification itself is NOT mocked: we use a real `Stripe` instance (a fake
// sk_test_ key, never sent over the network) so `constructEvent` /
// `generateTestHeaderString` run real local HMAC crypto, exactly as the brief
// requires ("ALL tests are OFFLINE").
const { getStripe } = vi.hoisted(() => ({ getStripe: vi.fn() }));
const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
const { captureError } = vi.hoisted(() => ({ captureError: vi.fn() }));
const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));

vi.mock("@/lib/stripe", () => ({ getStripe }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/observability", () => ({ captureError }));
vi.mock("next/cache", () => ({ revalidateTag }));

import { POST } from "./route";

const WEBHOOK_SECRET = "whsec_test_secret";
// Pinned to the same literal as src/lib/stripe.ts (see that file's comment
// for provenance). Only used here for local signature crypto — never talks
// to the network.
const realStripe = new Stripe("sk_test_xxx", { apiVersion: "2026-06-24.dahlia" });

function signedRequest(body: string, secret = WEBHOOK_SECRET): Request {
  const header = realStripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": header },
  });
}

function fakeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    metadata: { user_id: "user-1" },
    items: {
      data: [
        {
          price: { id: "price_standard_monthly" },
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      ],
    },
    ...overrides,
  };
}

type QueryResult = { data: unknown; error: unknown };

function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = ((onFulfilled: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled)) as PromiseLike<QueryResult>["then"];
  return builder as unknown as PromiseLike<QueryResult> & Record<string, unknown>;
}

function fakeAdmin(opts: {
  stripeEventsInsertResult?: { error: unknown };
  stripeEventsDeleteResult?: { error: unknown };
  byCustomerResult?: QueryResult;
  byUserResult?: QueryResult;
  upsertResult?: { error: unknown };
  detailsUpdateResult?: { error: unknown };
}) {
  const stripeEventsInsert = vi
    .fn()
    .mockResolvedValue(opts.stripeEventsInsertResult ?? { error: null });
  const stripeEventsDeleteEq = vi
    .fn()
    .mockResolvedValue(opts.stripeEventsDeleteResult ?? { error: null });
  const stripeEventsDelete = vi.fn(() => ({ eq: stripeEventsDeleteEq }));
  const upsert = vi.fn().mockResolvedValue(opts.upsertResult ?? { error: null });
  const detailsUpdateEq = vi
    .fn()
    .mockResolvedValue(opts.detailsUpdateResult ?? { error: null });
  const detailsUpdate = vi.fn<
    (payload: Record<string, unknown>) => { eq: typeof detailsUpdateEq }
  >(() => ({ eq: detailsUpdateEq }));

  const subsSelect = vi.fn(() => ({
    eq: (col: string) =>
      makeQueryBuilder(
        col === "stripe_customer_id"
          ? (opts.byCustomerResult ?? { data: null, error: null })
          : (opts.byUserResult ?? { data: null, error: null })
      ),
  }));

  const from = vi.fn((table: string) => {
    if (table === "stripe_events")
      return { insert: stripeEventsInsert, delete: stripeEventsDelete };
    if (table === "subscriptions") return { select: subsSelect, upsert };
    if (table === "photographer_details") return { update: detailsUpdate };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    from,
    stripeEventsInsert,
    stripeEventsDelete,
    stripeEventsDeleteEq,
    upsert,
    detailsUpdate,
    detailsUpdateEq,
  };
}

function stripeWithRetrieve(sub: unknown) {
  const clone = realStripe as unknown as Stripe;
  // Cast through unknown: we're stubbing a single method on a real Stripe
  // instance for the test, not modelling the whole SDK surface.
  (clone.subscriptions.retrieve as unknown as ReturnType<typeof vi.fn>) = vi
    .fn()
    .mockResolvedValue(sub);
  return clone;
}

const ORIGINAL_PRICE_ENV = process.env.STRIPE_PRICE_STANDARD_MONTHLY;

beforeEach(() => {
  getStripe.mockReset();
  createAdminClient.mockReset();
  captureError.mockReset();
  revalidateTag.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // priceIdToPlan (used by mapStripeSubscription, imported transitively from
  // ./plans) resolves via this env var — fakeSubscription()'s price id must
  // match so mapping succeeds in the "happy path" tests below.
  process.env.STRIPE_PRICE_STANDARD_MONTHLY = "price_standard_monthly";
});

afterEach(() => {
  if (ORIGINAL_PRICE_ENV === undefined) delete process.env.STRIPE_PRICE_STANDARD_MONTHLY;
  else process.env.STRIPE_PRICE_STANDARD_MONTHLY = ORIGINAL_PRICE_ENV;
});

describe("POST /api/stripe/webhook — config gates", () => {
  it("503s when STRIPE_WEBHOOK_SECRET is unset", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    getStripe.mockReturnValue(stripeWithRetrieve(fakeSubscription()));
    const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(503);
  });

  it("503s when getStripe() is null", async () => {
    getStripe.mockReturnValue(null);
    const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(503);
  });
});

describe("POST /api/stripe/webhook — signature verification", () => {
  it("400s on a tampered body (signature no longer matches)", async () => {
    getStripe.mockReturnValue(stripeWithRetrieve(fakeSubscription()));
    const signedBody = JSON.stringify({ id: "evt_1", type: "customer.subscription.updated" });
    const req = signedRequest(signedBody);
    // Re-issue the request with a body that differs from what was signed.
    const tampered = new Request(req.url, {
      method: "POST",
      body: JSON.stringify({ id: "evt_1", type: "customer.subscription.updated", tampered: true }),
      headers: req.headers,
    });

    const res = await POST(tampered);

    expect(res.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook — dedupe", () => {
  it("noops with 200 on a duplicate event (stripe_events insert unique-violation)", async () => {
    getStripe.mockReturnValue(stripeWithRetrieve(fakeSubscription()));
    const admin = fakeAdmin({
      stripeEventsInsertResult: { error: { code: "23505", message: "duplicate" } },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_dup",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true, duplicate: true });
    expect(admin.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook — event handling", () => {
  it("ignores an unhandled event type with 200 noop", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription());
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({});
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_ignored",
      type: "customer.updated",
      data: { object: { id: "cus_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(200);
    expect(admin.upsert).not.toHaveBeenCalled();
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("happy path: valid signed customer.subscription.updated with metadata.user_id upserts the mapped subscription", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription());
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({ byUserResult: { data: null, error: null } });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_happy",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(admin.upsert).toHaveBeenCalledTimes(1);
    const [payload, options] = admin.upsert.mock.calls[0];
    expect(payload).toMatchObject({
      user_id: "user-1",
      plan: "standard",
      status: "active",
      source: "stripe",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      cancel_at_period_end: false,
      comp_until: null,
    });
    expect(options).toEqual({ onConflict: "user_id" });
    expect(admin.detailsUpdate).toHaveBeenCalledTimes(1);
    expect(admin.detailsUpdate.mock.calls[0][0]).toMatchObject({ plan_tier: "standard" });
    expect(admin.detailsUpdateEq).toHaveBeenCalledWith("profile_id", "user-1");
    expect(revalidateTag).toHaveBeenCalledWith("photographers-directory", "max");
    expect(revalidateTag).toHaveBeenCalledWith("photographer:user-1", "max");
  });

  it("resolves the subscription id for checkout.session.completed from session.subscription", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription({ id: "sub_from_session" }));
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({ byUserResult: { data: null, error: null } });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          subscription: "sub_from_session",
          client_reference_id: "user-1",
          metadata: {},
        },
      },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(200);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_from_session");
    expect(admin.upsert).toHaveBeenCalledTimes(1);
  });

  it("resolves the subscription id for invoice.paid from invoice.parent.subscription_details.subscription", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription({ id: "sub_from_invoice" }));
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({ byUserResult: { data: null, error: null } });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_invoice",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          parent: { subscription_details: { subscription: "sub_from_invoice" } },
        },
      },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(200);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_from_invoice");
    expect(admin.upsert).toHaveBeenCalledTimes(1);
  });

  it("resolves the user via the stripe_customer_id lookup when no metadata/session hint is present, and captures nothing", async () => {
    const stripe = stripeWithRetrieve(
      fakeSubscription({ metadata: {} })
    );
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({
      byCustomerResult: { data: { user_id: "user-from-customer" }, error: null },
      byUserResult: { data: null, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_by_customer",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(200);
    expect(admin.upsert).toHaveBeenCalledTimes(1);
    expect(admin.upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-from-customer" });
    expect(captureError).not.toHaveBeenCalled();
  });

  it("returns 200 + captureError and never upserts for an unresolvable user", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription({ metadata: {} }));
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({
      byCustomerResult: { data: null, error: null },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_unresolvable",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(admin.upsert).not.toHaveBeenCalled();
    expect(captureError).toHaveBeenCalledTimes(1);
  });

  it("noops with 200 when the mapped status has no write (e.g. incomplete)", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription({ status: "incomplete" }));
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({});
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_incomplete",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(200);
    expect(admin.upsert).not.toHaveBeenCalled();
  });

  it("skips the write (comp-guard) when an active admin comp outranks the event", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription());
    getStripe.mockReturnValue(stripe);
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const admin = fakeAdmin({
      byUserResult: {
        data: { source: "admin_comp", comp_until: future, stripe_subscription_id: null },
        error: null,
      },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_comp_guard",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(200);
    expect(admin.upsert).not.toHaveBeenCalled();
  });

  it("returns 500 on a transient upsert failure so Stripe retries", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription());
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({
      byUserResult: { data: null, error: null },
      upsertResult: { error: { code: "500", message: "db unavailable" } },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_transient",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(500);
    expect(captureError).toHaveBeenCalled();
  });

  // FIX 1 — lost-write compensation: on a 500, the insert-first dedupe row
  // must be deleted so Stripe's retry reprocesses instead of dup'ing to a noop.
  it("compensates (deletes) the dedupe row and 500s when processing throws, so a retry reprocesses", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription());
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({
      byUserResult: { data: null, error: null },
      upsertResult: { error: { code: "500", message: "db unavailable" } },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_comp",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(500);
    expect(admin.stripeEventsDelete).toHaveBeenCalledTimes(1);
    expect(admin.stripeEventsDeleteEq).toHaveBeenCalledWith("id", "evt_comp");
  });

  // FIX 2a — a transient customer-lookup READ error must be retryable (500),
  // never a silent "unresolvable user" 200.
  it("500s (retryable) when the customer-lookup read errors, not a 200 noop", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription({ metadata: {} }));
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({
      byCustomerResult: { data: null, error: { code: "XX000", message: "read failed" } },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_custread",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(500);
    expect(admin.upsert).not.toHaveBeenCalled();
    expect(admin.stripeEventsDelete).toHaveBeenCalledTimes(1);
  });

  // FIX 2b — a transient existing-row READ error must be retryable (500) and
  // must NOT upsert (else the comp-guard is bypassed and an admin_comp gets
  // clobbered by source='stripe').
  it("500s and does NOT upsert when the existing-row read errors (comp-guard not bypassed)", async () => {
    const stripe = stripeWithRetrieve(fakeSubscription());
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({
      byUserResult: { data: null, error: { code: "XX000", message: "read failed" } },
    });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_exread",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(500);
    expect(admin.upsert).not.toHaveBeenCalled();
  });

  // FIX 4 — an entitled status with a missing current_period_end must 500 +
  // captureError, never silently free-downgrade the subscriber.
  it("500s + captures (no free-downgrade write) when an entitled sub is missing current_period_end", async () => {
    const stripe = stripeWithRetrieve(
      fakeSubscription({
        // active (entitled) status, but the item carries no current_period_end.
        items: {
          data: [{ price: { id: "price_standard_monthly" }, current_period_end: null }],
        },
      })
    );
    getStripe.mockReturnValue(stripe);
    const admin = fakeAdmin({ byUserResult: { data: null, error: null } });
    createAdminClient.mockReturnValue(admin);
    const body = JSON.stringify({
      id: "evt_noperiod",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123" } },
    });

    const res = await POST(signedRequest(body));

    expect(res.status).toBe(500);
    expect(captureError).toHaveBeenCalled();
    expect(admin.upsert).not.toHaveBeenCalled();
  });
});
