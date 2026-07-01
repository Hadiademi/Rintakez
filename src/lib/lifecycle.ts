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
// Test coverage note: this module is deliberately NOT unit-tested with a fake
// Supabase client. The supabase-js query builder is a chainable thenable
// (`.from().select().eq().lt().in().limit()`) — faking it meaningfully means
// re-implementing a small query engine, which would mostly test the fake, not
// this code. The actual risk here is the SQL predicate (which rows count as
// "eligible") and the idempotency guard, and both are exercised where they can
// fail for real: pgTAP (supabase/tests/database/lifecycle.test.sql) proves the
// welcome trigger and the lifecycle_email_log RLS posture against a real
// Postgres; the per-scan predicates (open+0 bids, completed+no review,
// photographer+no details) reuse column/predicate patterns already covered by
// other pgTAP suites (reliability.test.sql, messaging_reviews.test.sql). New
// predicate changes here should get a matching pgTAP case rather than a mock.
const ONBOARDING_REMINDER_DAYS = 3;
const ZERO_BID_RESCUE_DAYS = 3;
const REVIEW_REQUEST_DAYS = 5;

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
 * Photographers who signed up >= ONBOARDING_REMINDER_DAYS ago and still have
 * no photographer_details row (i.e. never finished onboarding). subject_id is
 * the profile id; recipient is the same profile.
 */
async function scanOnboardingReminder(admin: AdminClient): Promise<number> {
  const cutoff = new Date(
    Date.now() - ONBOARDING_REMINDER_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "photographer")
    .lt("created_at", cutoff)
    .limit(BATCH_LIMIT);
  if (!candidates || candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);

  const { data: withDetails } = await admin
    .from("photographer_details")
    .select("profile_id")
    .in("profile_id", ids);
  const hasDetails = new Set((withDetails ?? []).map((d) => d.profile_id));

  const logged = await alreadyLogged(
    admin,
    "onboarding_reminder",
    ids
  );

  let count = 0;
  for (const id of ids) {
    if (hasDetails.has(id) || logged.has(id)) continue;
    await admin.from("email_outbox").insert({
      recipient_id: id,
      kind: "onboarding_reminder",
    });
    await admin
      .from("lifecycle_email_log")
      .insert({ kind: "onboarding_reminder", subject_id: id });
    count++;
  }
  return count;
}

/**
 * Shoots still 'open' with zero bids >= ZERO_BID_RESCUE_DAYS after creation.
 * subject_id is the shoot id; recipient is the shoot's client.
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
    .in("shoot_id", ids);
  const hasBids = new Set((bidRows ?? []).map((b) => b.shoot_id));

  const logged = await alreadyLogged(admin, "zero_bid_rescue", ids);

  let count = 0;
  for (const shoot of candidates) {
    if (hasBids.has(shoot.id) || logged.has(shoot.id)) continue;
    await admin.from("email_outbox").insert({
      recipient_id: shoot.client_id,
      kind: "zero_bid_rescue",
      shoot_id: shoot.id,
      shoot_title: shoot.title,
    });
    await admin
      .from("lifecycle_email_log")
      .insert({ kind: "zero_bid_rescue", subject_id: shoot.id });
    count++;
  }
  return count;
}

/**
 * Shoots 'completed' with no review >= REVIEW_REQUEST_DAYS later. subject_id
 * is the shoot id; recipient is the shoot's client. shoots has no
 * completed_at/updated_at column, so created_at is used as a documented
 * approximation of "when it was completed" — slightly conservative (a shoot
 * usually completes some time after it's created, so the real wait before a
 * reminder is >= REVIEW_REQUEST_DAYS, never less).
 */
async function scanReviewRequest(admin: AdminClient): Promise<number> {
  const cutoff = new Date(
    Date.now() - REVIEW_REQUEST_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: candidates } = await admin
    .from("shoots")
    .select("id, client_id, title")
    .eq("status", "completed")
    .lt("created_at", cutoff)
    .limit(BATCH_LIMIT);
  if (!candidates || candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);

  const { data: reviewRows } = await admin
    .from("reviews")
    .select("shoot_id")
    .in("shoot_id", ids);
  const hasReview = new Set((reviewRows ?? []).map((r) => r.shoot_id));

  const logged = await alreadyLogged(admin, "review_request", ids);

  let count = 0;
  for (const shoot of candidates) {
    if (hasReview.has(shoot.id) || logged.has(shoot.id)) continue;
    await admin.from("email_outbox").insert({
      recipient_id: shoot.client_id,
      kind: "review_request",
      shoot_id: shoot.id,
      shoot_title: shoot.title,
    });
    await admin
      .from("lifecycle_email_log")
      .insert({ kind: "review_request", subject_id: shoot.id });
    count++;
  }
  return count;
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
