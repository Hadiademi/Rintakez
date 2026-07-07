"use server";

import { getProfile } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import {
  stripePriceId,
  ENTITLED_STRIPE_STATUSES,
  TRIAL_PERIOD_DAYS,
  type PaidPlan,
  type Interval,
} from "@/lib/billing/plans";

type ErrResult = { ok: false; error: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Whether Stripe Tax is enabled on Checkout Sessions. Kept off until the
// owner confirms Swiss VAT registration — flip to `true` only after that
// (see the launch-day checklist in .superpowers/sdd/subs-P3-report.md).
// Charging tax without being registered is a compliance problem, so this
// defaults conservatively off.
const AUTOMATIC_TAX_ENABLED = false as const;

type ExistingSubRow = {
  source: "stripe" | "admin_comp";
  status: string;
  comp_until: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
} | null;

/**
 * Create a hosted Stripe Checkout session for a photographer to subscribe to
 * a paid plan. Server-redirect only — no publishable key, no client Stripe
 * SDK (see the P3 brief: web-only billing, IAP tax avoided by never shipping
 * this in-app).
 */
export async function createCheckoutSession(
  plan: PaidPlan,
  interval: Interval
): Promise<{ ok: true; url: string } | ErrResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "unauthorized" };
  if (profile.role !== "photographer") return { ok: false, error: "forbidden" };

  if (!(await rateLimit(`checkout:${profile.id}`, 10, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "stripe_not_configured" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "generic" };

  const { data: existing } = (await admin
    .from("subscriptions")
    .select(
      "source,status,comp_until,current_period_end,stripe_customer_id,stripe_subscription_id"
    )
    .eq("user_id", profile.id)
    .maybeSingle()) as { data: ExistingSubRow };

  const now = new Date();

  if (
    existing &&
    existing.source === "admin_comp" &&
    existing.comp_until &&
    new Date(existing.comp_until) > now
  ) {
    return { ok: false, error: "comp_active" };
  }

  if (
    existing &&
    existing.source === "stripe" &&
    (ENTITLED_STRIPE_STATUSES as readonly string[]).includes(existing.status) &&
    existing.current_period_end &&
    new Date(existing.current_period_end) > now
  ) {
    return { ok: false, error: "already_subscribed" };
  }

  const price = stripePriceId(plan, interval);
  if (!price) return { ok: false, error: "price_unavailable" };

  // Anti trial-farming: only grant a trial the first time this user ever
  // creates a Stripe subscription. A canceled/expired prior subscription
  // still disqualifies them — churning and resubscribing must not refill the
  // trial.
  const trialPeriodDays = existing?.stripe_subscription_id
    ? undefined
    : TRIAL_PERIOD_DAYS;

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        ...(existing?.stripe_customer_id
          ? { customer: existing.stripe_customer_id }
          : {}),
        client_reference_id: profile.id,
        allow_promotion_codes: true,
        automatic_tax: { enabled: AUTOMATIC_TAX_ENABLED },
        subscription_data: {
          metadata: { user_id: profile.id },
          ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
        },
        metadata: { user_id: profile.id },
        success_url: `${SITE_URL}/${profile.locale}/profile#billing`,
        cancel_url: `${SITE_URL}/${profile.locale}/pricing`,
      },
      // Double-click protection: the same (user, plan, interval) triple maps
      // to one Checkout Session. Stripe idempotency keys expire after ~24h,
      // so a later legitimate retry (e.g. the user comes back tomorrow)
      // still creates a fresh session.
      { idempotencyKey: `checkout:${profile.id}:${plan}:${interval}` }
    );

    if (!session.url) return { ok: false, error: "generic" };
    return { ok: true, url: session.url };
  } catch (err) {
    captureError(err, { scope: "billing.createCheckoutSession", userId: profile.id });
    return { ok: false, error: "generic" };
  }
}

/**
 * Create a Stripe Customer Portal session so a subscribed photographer can
 * manage payment method, invoices, plan switching and cancellation
 * themselves.
 */
export async function createPortalSession(): Promise<
  { ok: true; url: string } | ErrResult
> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "unauthorized" };
  if (profile.role !== "photographer") return { ok: false, error: "forbidden" };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "stripe_not_configured" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "generic" };

  const { data: existing } = (await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", profile.id)
    .maybeSingle()) as { data: { stripe_customer_id: string | null } | null };

  if (!existing?.stripe_customer_id) return { ok: false, error: "no_customer" };

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: existing.stripe_customer_id,
      return_url: `${SITE_URL}/${profile.locale}/profile#billing`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    captureError(err, { scope: "billing.createPortalSession", userId: profile.id });
    return { ok: false, error: "generic" };
  }
}
