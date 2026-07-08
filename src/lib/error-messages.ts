const KNOWN = new Set([
  "invalid_input",
  "unauthorized",
  "forbidden",
  "already_bid",
  "already_reviewed",
  "not_found",
  "limit_reached",
  "quota_reached",
  "invalid_file",
  "invalid_credentials",
  "email_not_confirmed",
  "email_taken",
  "comp_conflicts_stripe",
  "not_photographer",
  "not_comp",
  // P3 — Stripe checkout/portal/webhook errors (subs-P3-brief). i18n copy for
  // the user-facing ones (comp_active/already_subscribed/etc.) lands in P4
  // with the pricing page; registering them here now just keeps
  // errorKey() from silently collapsing them to "generic" once P4 wires up
  // the UI that surfaces them.
  "stripe_not_configured",
  "comp_active",
  "already_subscribed",
  "price_unavailable",
  "no_customer",
  "billing_cancel_failed",
]);

/** Map an action error string to a stable i18n key under the `errors` namespace.
 *  Unknown/raw DB strings collapse to `generic` so internals never leak. */
export function errorKey(error: string): string {
  return KNOWN.has(error) ? error : "generic";
}
