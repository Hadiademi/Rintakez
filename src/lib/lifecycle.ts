import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";
import { zurichDateString, zurichHour } from "@/lib/billing/zurich";
import { photographerMatchesShoot } from "@/lib/shoot-match";

// Lifecycle emails (Task C2): periodic scans that catch silent-churn points
// the transactional triggers don't cover — a photographer who never finishes
// onboarding, a shoot nobody bid on, a completed shoot nobody reviewed. Each
// scan asks the database for eligible subjects, runs from the existing cron
// (see /api/cron/process), and enqueues an email_outbox row per subject. Unlike
// the transactional emails (fired once, from the action that causes them),
// these scans re-run on every cron tick and would re-match the same subject
// forever without a guard — so each send is paired with an insert into
// public.lifecycle_email_log (kind, subject_id), and the candidate query
// excludes subjects already present there. That table is service-role only (see
// 20260701080000_lifecycle_markers.sql), matching email_outbox's posture.
//
// The three cron scans below select candidates through SECURITY DEFINER
// functions (20260903120000_lifecycle_scan_candidates.sql) rather than
// assembling the predicate here. That is deliberate and load-bearing: the
// exclusion of already-notified subjects has to happen BEFORE the row limit.
// When it ran as a JavaScript filter afterwards, accumulated already-notified
// subjects consumed the whole batch and new ones were never reached — the
// scans quietly stopped sending while still reporting success.
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
// scanShootMatchDigest (P5b) is the one exception with meaningful
// TypeScript-side logic — its match predicate is extracted into the pure,
// directly-unit-tested photographerMatchesShoot (src/lib/shoot-match.ts), and
// its Zurich 08:00 hour gate is covered by zurich.test.ts; the scan body
// itself stays untested for the same query-builder-faking reason as its
// siblings, and its tier source (photographer_effective_tier) plus the
// email_outbox tier gate it complements are covered by pgTAP
// (shoot_match_alert_gating.test.sql).
const ONBOARDING_REMINDER_DAYS = 3;
const ZERO_BID_RESCUE_DAYS = 3;
const REVIEW_REQUEST_DAYS = 5;

// Bound each scan's work per cron tick so a large backlog (or a bug) cannot
// turn one invocation into an unbounded scan + fan-out. Since the candidate
// queries moved into SQL (20260903120000_lifecycle_scan_candidates.sql) this
// is a pure THROUGHPUT bound: every exclusion is applied before the limit, so
// a full batch means "more to do next tick", never "new subjects starved".
//
// (The "which bid statuses count as live" rule that used to live here now
// sits in lifecycle_zero_bid_candidates() next to the anti-join that uses it.)
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

  // Candidate selection (including the "not already notified" exclusion, the
  // missing-details check and the suspension filter) happens in SQL — see
  // 20260903120000_lifecycle_scan_candidates.sql. It used to be a `.limit()`
  // followed by a JavaScript filter, which meant the limit was consumed by
  // already-notified subjects and new ones were never reached.
  const { data: candidates, error } = await admin.rpc(
    "lifecycle_onboarding_candidates",
    { p_cutoff: cutoff, p_limit: BATCH_LIMIT }
  );
  if (error) throw error;

  const eligibleIds = (candidates ?? []).map((c) => c.profile_id);
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

  // One SQL query now covers what used to be four round trips plus a JS
  // filter: the zero-active-bids anti-join, the already-notified exclusion,
  // the suspension check and the notify_shoot_updates preference — all before
  // the limit, so the batch bound throttles throughput instead of silently
  // starving new shoots. See 20260903120000_lifecycle_scan_candidates.sql.
  const { data: candidates, error } = await admin.rpc(
    "lifecycle_zero_bid_candidates",
    { p_cutoff: cutoff, p_limit: BATCH_LIMIT }
  );
  if (error) throw error;

  const finalEligible = candidates ?? [];
  if (finalEligible.length === 0) return 0;

  const outboxRows = finalEligible.map((shoot) => ({
    recipient_id: shoot.client_id,
    kind: "zero_bid_rescue" as const,
    shoot_id: shoot.shoot_id,
    shoot_title: shoot.title,
  }));
  const { error: outboxError } = await admin
    .from("email_outbox")
    .insert(outboxRows);
  if (outboxError) throw outboxError;

  const markerRows = finalEligible.map((shoot) => ({
    kind: "zero_bid_rescue",
    subject_id: shoot.shoot_id,
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

  // Same shape as the zero-bid scan: the no-review anti-join, the
  // already-notified exclusion, suspension and the notify_shoot_updates
  // preference all resolve in SQL before the limit.
  const { data: candidates, error } = await admin.rpc(
    "lifecycle_review_request_candidates",
    { p_cutoff: cutoff, p_limit: BATCH_LIMIT }
  );
  if (error) throw error;

  const finalEligible = candidates ?? [];
  if (finalEligible.length === 0) return 0;

  const outboxRows = finalEligible.map((shoot) => ({
    recipient_id: shoot.client_id,
    kind: "review_request" as const,
    shoot_id: shoot.shoot_id,
    shoot_title: shoot.title,
  }));
  const { error: outboxError } = await admin
    .from("email_outbox")
    .insert(outboxRows);
  if (outboxError) throw outboxError;

  const markerRows = finalEligible.map((shoot) => ({
    kind: "review_request",
    subject_id: shoot.shoot_id,
  }));
  const { error: markerError } = await admin
    .from("lifecycle_email_log")
    .insert(markerRows);
  if (markerError) throw markerError;

  return finalEligible.length;
}

/**
 * Once-daily digest for BASIC-tier photographers: a summary email of shoots
 * that matched their coverage in the last 24h. standard/premium photographers
 * already get the instant shoot_match email (see
 * 20260708000000_shoot_match_alert_gating.sql); basic's value is this digest
 * instead — free gets neither. subject_id/recipient is the photographer id.
 *
 * Hour-gated to the Zurich 08:00 hour (rather than a fixed cron schedule) so
 * this stays a plain cron-tick scan like its siblings: the /api/cron/process
 * tick runs every 5 minutes, so this body actually executes ~12 times inside
 * the 08:00-08:59 window, but the per-day lifecycle_email_log marker
 * (kind=`shoot_match_digest:<zurich date>`) collapses that down to one send
 * per photographer per day — same AT-LEAST-ONCE, outbox-before-marker
 * ordering as every other scan here (see the module comment).
 */
async function scanShootMatchDigest(admin: AdminClient): Promise<number> {
  const now = new Date();
  if (zurichHour(now) !== 8) return 0;

  const markerKind = `shoot_match_digest:${zurichDateString(now)}`;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: candidateShoots } = await admin
    .from("shoots")
    .select("id, canton, discipline, client_id")
    .eq("status", "open")
    .gte("created_at", cutoff)
    .limit(BATCH_LIMIT);
  if (!candidateShoots || candidateShoots.length === 0) return 0;

  const { data: basicRows } = await admin
    .from("photographer_effective_tier")
    .select("profile_id")
    .eq("effective_tier", "basic");
  const basicIds = (basicRows ?? []).map((r) => r.profile_id as string);
  if (basicIds.length === 0) return 0;

  const { data: photographers } = await admin
    .from("photographer_details")
    .select("profile_id, coverage_cantons, disciplines")
    .in("profile_id", basicIds);
  if (!photographers || photographers.length === 0) return 0;

  const suspended = await suspendedIds(
    admin,
    photographers.map((p) => p.profile_id)
  );
  const prefEligible = await filterByNotifyShootUpdates(
    admin,
    photographers.map((p) => p.profile_id)
  );

  const matchedIds = photographers
    .filter(
      (p) =>
        !suspended.has(p.profile_id) &&
        prefEligible.has(p.profile_id) &&
        candidateShoots.some((shoot) => photographerMatchesShoot(shoot, p))
    )
    .map((p) => p.profile_id);
  if (matchedIds.length === 0) return 0;

  const logged = await alreadyLogged(admin, markerKind, matchedIds);
  const eligibleIds = matchedIds.filter((id) => !logged.has(id));
  if (eligibleIds.length === 0) return 0;

  // Bulk insert: enqueue the digest email for the whole batch first, then
  // write the markers — see the AT-LEAST-ONCE note above for why this order
  // matters.
  const outboxRows = eligibleIds.map((id) => ({
    recipient_id: id,
    kind: "shoot_match_digest" as const,
    shoot_id: null,
    shoot_title: null,
  }));
  const { error: outboxError } = await admin
    .from("email_outbox")
    .insert(outboxRows);
  if (outboxError) throw outboxError;

  const markerRows = eligibleIds.map((id) => ({
    kind: markerKind,
    subject_id: id,
  }));
  const { error: markerError } = await admin
    .from("lifecycle_email_log")
    .insert(markerRows);
  if (markerError) throw markerError;

  return eligibleIds.length;
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
 * Run all four lifecycle scans and enqueue outbox rows for newly-eligible
 * subjects. No-op without a configured service role (same graceful
 * degradation as the rest of the email pipeline). Never throws into the
 * caller — failures are captured and reported as zero for that scan.
 */
export async function runLifecycleScans(): Promise<{
  onboardingReminder: number;
  zeroBidRescue: number;
  reviewRequest: number;
  shootMatchDigest: number;
}> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      onboardingReminder: 0,
      zeroBidRescue: 0,
      reviewRequest: 0,
      shootMatchDigest: 0,
    };
  }

  const results = {
    onboardingReminder: 0,
    zeroBidRescue: 0,
    reviewRequest: 0,
    shootMatchDigest: 0,
  };

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

  try {
    results.shootMatchDigest = await scanShootMatchDigest(admin);
  } catch (err) {
    captureError(err, { scope: "lifecycle.shoot_match_digest" });
  }

  return results;
}
