import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";

// Lifecycle emails (Task C2): periodic scans that catch silent-churn points
// the transactional triggers don't cover — a photographer who never finishes
// onboarding, a shoot nobody bid on, a completed shoot nobody reviewed. Each
// scan is a plain SELECT for eligible subjects, run from the existing cron
// (see /api/cron/process), enqueuing an email_outbox row per subject. Unlike
// the transactional emails (fired once, from the action that causes them),
// these scans re-run on every cron tick and would re-match the same subject
// forever without a guard — so each send is paired with an insert into
// public.lifecycle_email_log (kind, subject_id), and the SELECT excludes
// subjects already present there. That table is service-role only (see
// 20260701080000_lifecycle_markers.sql), matching email_outbox's posture.
//
// N days are small named constants rather than env/config — they are product
// behavior, not deployment config, and keeping them in code keeps the scan
// predicate and the "why" comment next to each other.
//
// Delivery guarantee: AT-LEAST-ONCE. Each subject's email_outbox row is
// inserted BEFORE its lifecycle_email_log marker row (see the bulk inserts
// below). If the process dies (or the marker insert fails) between the two,
// the next cron tick will re-match the same subject and send a duplicate —
// annoying but safe. The ordering is never reversed: writing the marker first
// would risk the opposite failure (a subject marked "notified" whose email
// never actually got enqueued), which is a silent drop and strictly worse.
//
// Test coverage note: this module is deliberately NOT unit-tested with a fake
// Supabase client. The supabase-js query builder is a chainable thenable
// (`.from().select().eq().lt().in().limit()`) — faking it meaningfully means
// re-implementing a small query engine, which would mostly test the fake, not
// this code. The actual risk here is the SQL predicate (which rows count as
// "eligible") and the idempotency guard, and both are exercised where they can
// fail for real: pgTAP (supabase/tests/database/lifecycle.test.sql) proves the
// welcome trigger and the lifecycle_email_log RLS posture against a real
// Postgres; the per-scan predicates (open+0 active bids, completed+no review,
// photographer+no details) reuse column/predicate patterns already covered by
// other pgTAP suites (reliability.test.sql, messaging_reviews.test.sql). New
// predicate changes here should get a matching pgTAP case rather than a mock.
const ONBOARDING_REMINDER_DAYS = 3;
const ZERO_BID_RESCUE_DAYS = 3;
const REVIEW_REQUEST_DAYS = 5;

// Bids in these statuses still count as "the shoot has a live bid" — a
// withdrawn (or declined) bid must NOT protect a shoot from the zero-bid
// rescue email, since from the client's perspective they still have nobody
// actively bidding. Mirrors withdrawBidAction, which sets status='withdrawn'
// rather than deleting the row.
const ACTIVE_BID_STATUSES = ["pending", "accepted"] as const;

// Bound each scan's work per cron tick so a large backlog (or a bug) cannot
// turn one invocation into an unbounded scan + fan-out.
const BATCH_LIMIT = 100;

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function alreadyLogged(
  admin: AdminClient,
  kind: string,
  subjectIds: string[]
): Promise<Set<string>> {
  if (subjectIds.length === 0) return new Set();
  const { data } = await admin
    .from("lifecycle_email_log")
    .select("subject_id")
    .eq("kind", kind)
    .in("subject_id", subjectIds);
  return new Set((data ?? []).map((r) => r.subject_id as string));
}

/**
 * Given a set of profile ids, return the subset that is suspended. Used to
 * exclude suspended subjects/recipients from every scan below, mirroring the
 * `not p.is_suspended` guard in notify_matching_photographers
 * (20260701040000_shoot_match_alerts.sql).
 */
async function suspendedIds(
  admin: AdminClient,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("id", ids)
    .eq("is_suspended", true);
  return new Set((data ?? []).map((p) => p.id as string));
}

/**
 * Photographers who signed up >= ONBOARDING_REMINDER_DAYS ago and still have
 * no photographer_details row (i.e. never finished onboarding). subject_id is
 * the profile id; recipient is the same profile.
 *
 * Intentionally NOT preference-gated: there is no notification-preference
 * column that fits "reminders about my own onboarding" (notify_bids/
 * notify_shoot_updates/notify_messages are all about other people's
 * activity), so this scan always sends, same as before. It still excludes
 * suspended photographers (see FIX 2).
 */
async function scanOnboardingReminder(admin: AdminClient): Promise<number> {
  const cutoff = new Date(
    Date.now() - ONBOARDING_REMINDER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "photographer")
    .eq("is_suspended", false)
    .lt("created_at", cutoff)
    .limit(BATCH_LIMIT);
  if (!candidates || candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);

  const { data: withDetails } = await admin
    .from("photographer_details")
    .select("profile_id")
    .in("profile_id", ids);
  const hasDetails = new Set((withDetails ?? []).map((d) => d.profile_id));

  const logged = await alreadyLogged(admin, "onboarding_reminder", ids);

  const eligibleIds = ids.filter(
    (id) => !hasDetails.has(id) && !logged.has(id)
  );
  if (eligibleIds.length === 0) return 0;

  // Bulk insert: enqueue the email for the whole batch first, then write the
  // markers — see the AT-LEAST-ONCE note above for why this order matters.
  const outboxRows = eligibleIds.map((id) => ({
    recipient_id: id,
    kind: "onboarding_reminder" as const,
  }));
  const { error: outboxError } = await admin
    .from("email_outbox")
    .insert(outboxRows);
  if (outboxError) throw outboxError;

  const markerRows = eligibleIds.map((id) => ({
    kind: "onboarding_reminder",
    subject_id: id,
  }));
  const { error: markerError } = await admin
    .from("lifecycle_email_log")
    .insert(markerRows);
  if (markerError) throw markerError;

  return eligibleIds.length;
}

/**
 * Shoots still 'open' with zero ACTIVE bids >= ZERO_BID_RESCUE_DAYS after
 * creation. subject_id is the shoot id; recipient is the shoot's client.
 * "Active" excludes 'withdrawn' and 'declined' bids — a shoot whose only bids
 * were withdrawn has, in effect, zero bids and must still be eligible for the
 * rescue email.
 */
async function scanZeroBidRescue(admin: AdminClient): Promise<number> {
  const cutoff = new Date(
    Date.now() - ZERO_BID_RESCUE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates } = await admin
    .from("shoots")
    .select("id, client_id, title")
    .eq("status", "open")
    .lt("created_at", cutoff)
    .limit(BATCH_LIMIT);
  if (!candidates || candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);

  const { data: bidRows } = await admin
    .from("bids")
    .select("shoot_id")
    .in("shoot_id", ids)
    .in("status", ACTIVE_BID_STATUSES);
  const hasActiveBids = new Set((bidRows ?? []).map((b) => b.shoot_id));

  const logged = await alreadyLogged(admin, "zero_bid_rescue", ids);

  const clientIds = [...new Set(candidates.map((c) => c.client_id))];
  const suspendedClients = await suspendedIds(admin, clientIds);

  const eligible = candidates.filter(
    (shoot) =>
      !hasActiveBids.has(shoot.id) &&
      !logged.has(shoot.id) &&
      !suspendedClients.has(shoot.client_id)
  );
  if (eligible.length === 0) return 0;

  // Respect the client's shoot-update preference, same column/default
  // notify_matching_photographers uses (coalesce(..., true)).
  const prefEligibleIds = await filterByNotifyShootUpdates(
    admin,
    eligible.map((s) => s.client_id)
  );
  const finalEligible = eligible.filter((s) =>
    prefEligibleIds.has(s.client_id)
  );
  if (finalEligible.length === 0) return 0;

  const outboxRows = finalEligible.map((shoot) => ({
    recipient_id: shoot.client_id,
    kind: "zero_bid_rescue" as const,
    shoot_id: shoot.id,
    shoot_title: shoot.title,
  }));
  const { error: outboxError } = await admin
    .from("email_outbox")
    .insert(outboxRows);
  if (outboxError) throw outboxError;

  const markerRows = finalEligible.map((shoot) => ({
    kind: "zero_bid_rescue",
    subject_id: shoot.id,
  }));
  const { error: markerError } = await admin
    .from("lifecycle_email_log")
    .insert(markerRows);
  if (markerError) throw markerError;

  return finalEligible.length;
}

/**
 * Shoots 'completed' with no review >= REVIEW_REQUEST_DAYS later. subject_id
 * is the shoot id; recipient is the shoot's client. The N-day window is
 * measured off shoots.completed_at — the timestamp complete_shoot() stamps at
 * actual completion — so a reminder never fires before the shoot has genuinely
 * been done for REVIEW_REQUEST_DAYS.
 *
 * Shoots completed before completed_at existed carry a NULL value; they are
 * simply excluded by the `.lt("completed_at", cutoff)` filter (NULLs never
 * satisfy a comparison) — a one-time gap for pre-column history, not an
 * ongoing correctness issue.
 */
async function scanReviewRequest(admin: AdminClient): Promise<number> {
  const cutoff = new Date(
    Date.now() - REVIEW_REQUEST_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates } = await admin
    .from("shoots")
    .select("id, client_id, title")
    .eq("status", "completed")
    .lt("completed_at", cutoff)
    .limit(BATCH_LIMIT);
  if (!candidates || candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);

  const { data: reviewRows } = await admin
    .from("reviews")
    .select("shoot_id")
    .in("shoot_id", ids);
  const hasReview = new Set((reviewRows ?? []).map((r) => r.shoot_id));

  const logged = await alreadyLogged(admin, "review_request", ids);

  const clientIds = [...new Set(candidates.map((c) => c.client_id))];
  const suspendedClients = await suspendedIds(admin, clientIds);

  const eligible = candidates.filter(
    (shoot) =>
      !hasReview.has(shoot.id) &&
      !logged.has(shoot.id) &&
      !suspendedClients.has(shoot.client_id)
  );
  if (eligible.length === 0) return 0;

  const prefEligibleIds = await filterByNotifyShootUpdates(
    admin,
    eligible.map((s) => s.client_id)
  );
  const finalEligible = eligible.filter((s) =>
    prefEligibleIds.has(s.client_id)
  );
  if (finalEligible.length === 0) return 0;

  const outboxRows = finalEligible.map((shoot) => ({
    recipient_id: shoot.client_id,
    kind: "review_request" as const,
    shoot_id: shoot.id,
    shoot_title: shoot.title,
  }));
  const { error: outboxError } = await admin
    .from("email_outbox")
    .insert(outboxRows);
  if (outboxError) throw outboxError;

  const markerRows = finalEligible.map((shoot) => ({
    kind: "review_request",
    subject_id: shoot.id,
  }));
  const { error: markerError } = await admin
    .from("lifecycle_email_log")
    .insert(markerRows);
  if (markerError) throw markerError;

  return finalEligible.length;
}

/**
 * Given client profile ids, return the subset whose notify_shoot_updates
 * preference is not explicitly false (i.e. coalesce(notify_shoot_updates,
 * true)), matching how notify_matching_photographers gates shoot_match
 * emails.
 */
async function filterByNotifyShootUpdates(
  admin: AdminClient,
  clientIds: string[]
): Promise<Set<string>> {
  if (clientIds.length === 0) return new Set();
  const { data } = await admin
    .from("profiles")
    .select("id, notify_shoot_updates")
    .in("id", clientIds);
  return new Set(
    (data ?? [])
      .filter((p) => p.notify_shoot_updates !== false)
      .map((p) => p.id as string)
  );
}

/**
 * Run all three lifecycle scans and enqueue outbox rows for newly-eligible
 * subjects. No-op without a configured service role (same graceful
 * degradation as the rest of the email pipeline). Never throws into the
 * caller — failures are captured and reported as zero for that scan.
 */
export async function runLifecycleScans(): Promise<{
  onboardingReminder: number;
  zeroBidRescue: number;
  reviewRequest: number;
}> {
  const admin = createAdminClient();
  if (!admin) {
    return { onboardingReminder: 0, zeroBidRescue: 0, reviewRequest: 0 };
  }

  const results = { onboardingReminder: 0, zeroBidRescue: 0, reviewRequest: 0 };

  try {
    results.onboardingReminder = await scanOnboardingReminder(admin);
  } catch (err) {
    captureError(err, { scope: "lifecycle.onboarding_reminder" });
  }

  try {
    results.zeroBidRescue = await scanZeroBidRescue(admin);
  } catch (err) {
    captureError(err, { scope: "lifecycle.zero_bid_rescue" });
  }

  try {
    results.reviewRequest = await scanReviewRequest(admin);
  } catch (err) {
    captureError(err, { scope: "lifecycle.review_request" });
  }

  return results;
}
