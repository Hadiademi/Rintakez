// Pure, version-agnostic sync logic for reconciling a Stripe subscription
// into our `subscriptions` + `photographer_details` rows. ZERO Stripe-SDK
// imports — the webhook route (src/app/api/stripe/webhook/route.ts) does all
// SDK-shape extraction (which fields live where varies by pinned API
// version) and passes this file a NormalizedSub. That keeps this file, and
// its test suite, immune to Stripe SDK upgrades.

import { priceIdToPlan, ENTITLED_STRIPE_STATUSES, type Plan } from "./plans";

/** A Stripe subscription reduced to exactly the fields this module needs,
 *  extracted by the webhook route from whatever SDK shape the pinned API
 *  version returns. */
export type NormalizedSub = {
  id: string;
  customerId: string;
  priceId: string | null;
  stripeStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEndUnix: number | null;
  userIdMeta: string | null;
};

export type MappedSub = {
  plan: Exclude<Plan, "free">;
  status: "active" | "trialing" | "past_due" | "canceled";
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type ExistingSub = {
  source: "stripe" | "admin_comp";
  comp_until: string | null;
  stripe_subscription_id: string | null;
} | null;

// Stripe subscription statuses that map onto our 4-value status column.
// `unpaid` (all dunning retries exhausted, `send_invoice` collection) is
// treated the same as `canceled` — the customer is not paying and has no
// access. `incomplete`/`incomplete_expired` (first payment never completed)
// and `paused` (trial ended, no payment method) are intentionally NOT in this
// map — they resolve to `undefined` below, which means "no-write": we've
// never granted access for these, so there's nothing to converge.
const STATUS_MAP: Partial<
  Record<string, "active" | "trialing" | "past_due" | "canceled">
> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "canceled",
};

/**
 * Maps a normalized Stripe subscription to our internal shape, or null when
 * there is nothing to write (an unmapped status, or a price that doesn't
 * resolve to one of our paid plans — e.g. a stale/removed Price id).
 */
export function mapStripeSubscription(n: NormalizedSub): MappedSub | null {
  const status = STATUS_MAP[n.stripeStatus];
  if (!status) return null;

  if (!n.priceId) return null;
  const plan = priceIdToPlan(n.priceId);
  if (!plan || plan === "free") return null;

  const currentPeriodEnd = n.currentPeriodEndUnix
    ? new Date(n.currentPeriodEndUnix * 1000).toISOString()
    : null;

  return {
    plan,
    status,
    stripeSubscriptionId: n.id,
    stripeCustomerId: n.customerId,
    currentPeriodEnd,
    cancelAtPeriodEnd: n.cancelAtPeriodEnd,
  };
}

/**
 * True when the incoming (mapped) Stripe event must NOT be written over the
 * existing subscriptions row:
 *
 *  (a) comp-guard — an active admin comp (source='admin_comp' with a future
 *      comp_until) always outranks any Stripe event. A manually-granted comp
 *      is a deliberate override; a webhook (possibly delivered out of order,
 *      or for an old/abandoned checkout) must never clobber it.
 *  (b) stale-cancel guard — a `canceled` event for an OLD Stripe subscription
 *      id must not override a currently-live DIFFERENT subscription id (e.g.
 *      the user churned and resubscribed; the old subscription's async
 *      cancellation webhook arrives after the new one's activation webhook).
 */
export function shouldSkipWrite(
  existing: ExistingSub,
  incoming: MappedSub,
  now: Date
): boolean {
  if (!existing) return false;

  if (
    existing.source === "admin_comp" &&
    existing.comp_until &&
    new Date(existing.comp_until) > now
  ) {
    return true;
  }

  if (
    incoming.status === "canceled" &&
    existing.source === "stripe" &&
    existing.stripe_subscription_id &&
    existing.stripe_subscription_id !== incoming.stripeSubscriptionId
  ) {
    return true;
  }

  return false;
}

/**
 * Derives the `photographer_details.plan_tier`/`plan_expires_at` values that
 * should follow from a mapped subscription. Entitled iff the status is one of
 * ENTITLED_STRIPE_STATUSES (active/trialing/past_due — past_due keeps access
 * during Stripe's dunning window) AND the current period end is still in the
 * future; otherwise the user reverts to the free tier.
 */
export function detailsSyncValues(
  m: MappedSub,
  now: Date
): { plan_tier: Plan; plan_expires_at: string | null } {
  const entitled =
    (ENTITLED_STRIPE_STATUSES as readonly string[]).includes(m.status) &&
    m.currentPeriodEnd !== null &&
    new Date(m.currentPeriodEnd) > now;

  return entitled
    ? { plan_tier: m.plan, plan_expires_at: m.currentPeriodEnd }
    : { plan_tier: "free", plan_expires_at: null };
}
