import "server-only";
import Stripe from "stripe";

// PINNED to the exact literal the installed `stripe` SDK's types accept
// (the SDK's internal `LatestApiVersion` type, read from
// node_modules/stripe/cjs/apiVersion.d.ts at the time this was written:
// `stripe@22.3.0` → "2026-06-24.dahlia"). `LatestApiVersion` itself isn't
// re-exported from the package's public `Stripe` namespace, so we can't
// name the type directly here — but the literal below is still checked: it's
// passed straight into the `Stripe` constructor below, whose `apiVersion`
// option IS typed as `LatestApiVersion`, so a stale/wrong literal fails to
// compile (a TS union-type error) rather than silently sending the wrong
// version. This stops an automatic Stripe account-level API upgrade from
// silently changing the object shapes our webhook route reads (e.g.
// `current_period_end` living on subscription items rather than the
// subscription itself in this version) out from under us. Bumping this is a
// deliberate, tested change — not a side effect of `npm update`.
const PINNED_API_VERSION = "2026-06-24.dahlia";

/**
 * Server-only Stripe client. Returns null when STRIPE_SECRET_KEY is unset so
 * callers degrade gracefully (mirrors createAdminClient in
 * src/lib/supabase/admin.ts).
 */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: PINNED_API_VERSION });
}
