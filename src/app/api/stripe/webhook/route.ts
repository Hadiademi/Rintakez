import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";
import {
  mapStripeSubscription,
  shouldSkipWrite,
  detailsSyncValues,
  type NormalizedSub,
  type ExistingSub,
} from "@/lib/billing/stripe-sync";
import { ENTITLED_STRIPE_STATUSES } from "@/lib/billing/plans";

// Convergent Stripe webhook — the single writer of `subscriptions` /
// `photographer_details.plan_tier` for the `source='stripe'` path (spec:
// subs-P3-brief). Always re-fetches the subscription fresh from Stripe
// rather than trusting the event payload, so out-of-order deliveries
// converge on Stripe's current truth instead of a stale snapshot.
export const dynamic = "force-dynamic";

const HANDLED_EVENT_TYPES = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer
): string {
  return typeof customer === "string" ? customer : customer.id;
}

/** Extracts exactly the fields stripe-sync.ts needs from a freshly-retrieved
 *  Stripe.Subscription. NOTE: as of the pinned API version (2026-06-24, see
 *  src/lib/stripe.ts), `current_period_end` lives on the subscription's
 *  first item, not on the subscription object itself — an SDK-shape detail
 *  this route absorbs so stripe-sync.ts stays version-agnostic. */
function normalizeSubscription(sub: Stripe.Subscription): NormalizedSub {
  const item = sub.items.data[0];
  return {
    id: sub.id,
    customerId: customerIdOf(sub.customer),
    priceId: item?.price.id ?? null,
    stripeStatus: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEndUnix: item?.current_period_end ?? null,
    userIdMeta: sub.metadata.user_id ?? null,
  };
}

/** Which Stripe subscription this event is about, plus a user-id hint
 *  available only for checkout.session.completed (client_reference_id /
 *  session metadata — set at session-creation time in
 *  src/lib/actions/billing.ts). Every other handled event type falls
 *  straight through to the subscription's own metadata.user_id, set there
 *  because subscription_data.metadata is copied onto the subscription by
 *  Stripe at checkout completion. */
function resolveSubject(event: Stripe.Event): {
  subId: string | null;
  sessionUserHint: string | null;
} {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const sub = session.subscription;
      const subId = typeof sub === "string" ? sub : (sub?.id ?? null);
      const hint = session.client_reference_id ?? session.metadata?.user_id ?? null;
      return { subId, sessionUserHint: hint };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return { subId: event.data.object.id, sessionUserHint: null };
    case "invoice.paid":
    case "invoice.payment_failed": {
      // As of the pinned API version, an invoice's subscription lives at
      // `parent.subscription_details.subscription`, not the top-level
      // `invoice.subscription` field of older API versions.
      const invoice = event.data.object;
      const subDetails = invoice.parent?.subscription_details?.subscription ?? null;
      const subId = typeof subDetails === "string" ? subDetails : (subDetails?.id ?? null);
      return { subId, sessionUserHint: null };
    }
    default:
      return { subId: null, sessionUserHint: null };
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    // No captureError: a bad/absent signature is expected-hostile traffic
    // (probing, replayed bodies, random scanners). Logging every one would let
    // an attacker drive unbounded log volume. Just reject with 400.
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // Dedupe BEFORE processing (inserted first, not after): a retry of an
  // in-flight event dups out here instead of racing the write below.
  const { error: dedupeError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (dedupeError) {
    if (dedupeError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    captureError(dedupeError, { scope: "stripe.webhook.dedupe", eventId: event.id });
    return NextResponse.json({ error: "dedupe_failed" }, { status: 500 });
  }

  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    const { subId, sessionUserHint } = resolveSubject(event);
    if (!subId) return NextResponse.json({ received: true });

    // Always retrieve fresh — never trust the event payload's snapshot, so
    // convergence holds even when events arrive out of order.
    const sub = await stripe.subscriptions.retrieve(subId);
    const normalized = normalizeSubscription(sub);

    // F6 user-resolution chain: subscription metadata → checkout-session hint
    // → an existing row keyed by customer id.
    let userId = normalized.userIdMeta ?? sessionUserHint ?? null;
    if (!userId) {
      const { data: byCustomer, error: byCustomerError } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", normalized.customerId)
        .maybeSingle();
      // A transient READ error must be retryable — throwing lands it in the
      // 500 catch below (which also compensates the dedupe row). Swallowing it
      // would look like "no match" and wrongly ack with a non-retryable 200,
      // permanently losing the write. Only a genuine (error-free) no-match
      // falls through to the deliberate unresolvable-user 200 below.
      if (byCustomerError) throw byCustomerError;
      userId = (byCustomer as { user_id: string } | null)?.user_id ?? null;
    }
    if (!userId) {
      // Permanent, non-retryable — this event will never resolve to a user
      // on retry either, so we ack it (200) and flag it for manual triage
      // rather than looping Stripe's retry schedule forever.
      captureError(new Error("stripe webhook: unresolvable user"), {
        scope: "stripe.webhook.resolveUser",
        eventId: event.id,
        eventType: event.type,
        subscriptionId: subId,
        customerId: normalized.customerId,
      });
      return NextResponse.json({ received: true });
    }

    const mapped = mapStripeSubscription(normalized);
    if (!mapped) return NextResponse.json({ received: true });

    // Guard a silent entitlement downgrade: an entitled status
    // (active/trialing/past_due) with a missing/null current_period_end would
    // make detailsSyncValues() write plan_tier:'free', un-entitling a paying
    // subscriber. That's a data anomaly (Stripe normally always carries a
    // period on an entitled sub), so surface it and 500 (retryable) rather
    // than writing free. A canceled/unpaid status with a null period is a
    // legitimate free-sync and is intentionally NOT caught here.
    if (
      (ENTITLED_STRIPE_STATUSES as readonly string[]).includes(mapped.status) &&
      mapped.currentPeriodEnd === null
    ) {
      captureError(
        new Error("stripe webhook: entitled subscription missing current_period_end"),
        {
          scope: "stripe.webhook.missingPeriodEnd",
          eventId: event.id,
          eventType: event.type,
          subscriptionId: mapped.stripeSubscriptionId,
          status: mapped.status,
        }
      );
      throw new Error("entitled subscription missing current_period_end");
    }

    const { data: existingRow, error: existingError } = await admin
      .from("subscriptions")
      .select("source,comp_until,stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();
    // A transient READ error here must be retryable, not silently treated as
    // "no existing row" — that would make shouldSkipWrite() return false and
    // let the upsert CLOBBER an active admin_comp with source='stripe'. Throw
    // into the 500 catch (which compensates the dedupe row) instead.
    if (existingError) throw existingError;
    const existing: ExistingSub = existingRow
      ? {
          source: existingRow.source as "stripe" | "admin_comp",
          comp_until: existingRow.comp_until,
          stripe_subscription_id: existingRow.stripe_subscription_id,
        }
      : null;

    const now = new Date();
    if (shouldSkipWrite(existing, mapped, now)) {
      return NextResponse.json({ received: true });
    }

    const { error: upsertError } = await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        plan: mapped.plan,
        status: mapped.status,
        source: "stripe",
        stripe_customer_id: mapped.stripeCustomerId,
        stripe_subscription_id: mapped.stripeSubscriptionId,
        current_period_end: mapped.currentPeriodEnd,
        cancel_at_period_end: mapped.cancelAtPeriodEnd,
        comp_until: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (upsertError) {
      if (upsertError.code === "23503") {
        // Permanent, non-retryable — the FK on user_id violated because the
        // profile no longer exists. deleteAccount() cancels the Stripe
        // subscription BEFORE cascade-deleting the profile (and this
        // subscriptions row); this event's cancellation webhook typically
        // lands after that delete, so by the time we get here there's no
        // profile left to write against and the subscription is already
        // canceled in Stripe. Retrying would only recreate this same FK
        // violation forever, so ack (200) and flag it — do NOT compensate
        // the dedupe row, we want this event marked processed.
        captureError(upsertError, {
          scope: "stripe.webhook.subscriptions.profileDeleted",
          eventId: event.id,
          eventType: event.type,
          userId,
          reason: "profile_deleted",
        });
        return NextResponse.json({ received: true, profileDeleted: true });
      }
      throw upsertError;
    }

    const details = detailsSyncValues(mapped, now);
    const { error: detailsError } = await admin
      .from("photographer_details")
      .update({ plan_tier: details.plan_tier, plan_expires_at: details.plan_expires_at })
      .eq("profile_id", userId);
    if (detailsError) throw detailsError;

    revalidateTag("photographers-directory", "max");
    revalidateTag(`photographer:${userId}`, "max");

    return NextResponse.json({ received: true });
  } catch (err) {
    // Transient DB/Stripe failure — 500 so Stripe retries. (The
    // unresolvable-user branch above is a deliberate 200, not a throw.)
    captureError(err, {
      scope: "stripe.webhook.process",
      eventId: event.id,
      eventType: event.type,
    });
    // COMPENSATE the insert-first dedupe: the stripe_events row was committed
    // (autocommit) before processing, so on a transient failure it would make
    // Stripe's retry dedupe to a 200 noop — permanently LOSING this write.
    // Best-effort delete it so the retry reprocesses; a delete failure is
    // captured but still returns 500 (the retry will re-collide on the row and
    // dup out, which is the pre-fix behaviour, not worse).
    try {
      const { error: compError } = await admin
        .from("stripe_events")
        .delete()
        .eq("id", event.id);
      if (compError) {
        captureError(compError, {
          scope: "stripe.webhook.dedupe.compensate",
          eventId: event.id,
        });
      }
    } catch (compErr) {
      captureError(compErr, {
        scope: "stripe.webhook.dedupe.compensate",
        eventId: event.id,
      });
    }
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
