"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { captureError } from "@/lib/observability";

type ErrResult = { ok: false; error: string };

/**
 * PostgREST caps every response at the project's `max-rows` setting (1000 by
 * default — see supabase/config.toml:17 for the local mirror). It does this
 * SILENTLY: no error, no partial-result flag, just fewer rows. An unbounded
 * `.select()` in a subject-access export therefore hands the user a file that
 * looks complete and is not, which is a compliance failure rather than a bug.
 *
 * So every list read below is paged explicitly. Two rules make paging correct:
 *
 *  1. Each page needs a STABLE total order, or `.range()` can skip or repeat
 *     rows between round trips. Every query orders by its primary key (or, for
 *     the composite-key tables, by the half that varies once the caller's own
 *     id is fixed).
 *  2. A fresh query builder per page — a supabase-js builder cannot be awaited
 *     twice — which is why `fetchAllRows` takes a factory, not a query.
 */
const EXPORT_PAGE_SIZE = 1000;

/**
 * Hard ceiling per dataset, so a pathological account cannot turn one export
 * into an unbounded scan. Reaching it is recorded in `export_complete` rather
 * than silently truncating — the exact failure this function exists to avoid.
 */
const EXPORT_MAX_ROWS = 50_000;

type PageResult<T> = { data: T[] | null; error: unknown };

async function fetchAllRows<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  incomplete: string[]
): Promise<T[]> {
  const rows: T[] = [];

  for (;;) {
    const from = rows.length;
    const { data, error } = await page(from, from + EXPORT_PAGE_SIZE - 1);

    if (error) {
      // Return what we have rather than failing the whole export, but never
      // pretend it is complete.
      captureError(error, { scope: "privacy.exportMyData", dataset: label });
      incomplete.push(label);
      break;
    }

    const batch = data ?? [];
    rows.push(...batch);

    // A short page is the last page. `rows.length` is a safe next offset
    // precisely because every earlier page was full.
    if (batch.length < EXPORT_PAGE_SIZE) break;

    if (rows.length >= EXPORT_MAX_ROWS) {
      incomplete.push(label);
      break;
    }
  }

  return rows;
}

/**
 * Data Subject Access Request (revFADP Art. 25 / GDPR Art. 15): return all
 * personal data held about the current user, in machine-readable JSON. Reads run
 * through the user's own RLS-scoped client, so the result is exactly the data
 * they are entitled to.
 */
export async function exportMyData(): Promise<
  { ok: true; data: Record<string, unknown> } | ErrResult
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();

  // Datasets that could not be read in full (page error or the row ceiling).
  // Surfaced in the payload so a truncated export is never mistaken for a
  // complete one by the subject or by us.
  const incomplete: string[] = [];

  const [
    profile,
    details,
    unavailable,
    shoots,
    bids,
    messages,
    reviewsWritten,
    reviewsReceived,
    favorites,
    reports,
    disputes,
    userBlocks,
    notifications,
    shootInvitations,
  ] = await Promise.all([
    // current_profile() (SECURITY DEFINER) returns the caller's own full row,
    // including the columns the column-scoped profiles SELECT grant excludes
    // (20260709000000_profiles_column_privacy) — needed here so the nDSG/GDPR
    // export still includes everything the user is entitled to about themself.
    // No `.maybeSingle()`: the function returns a single row (or null)
    // already (see src/lib/auth.ts for why chaining it breaks inference).
    // Single row, so no paging.
    supabase.rpc("current_profile"),
    supabase
      .from("photographer_details")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
    fetchAllRows("unavailable_dates", (from, to) =>
      supabase
        .from("photographer_unavailable")
        .select("*")
        .eq("photographer_id", user.id)
        .order("date", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("shoots", (from, to) =>
      supabase
        .from("shoots")
        .select("*")
        .eq("client_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("bids", (from, to) =>
      supabase
        .from("bids")
        .select("*")
        .eq("photographer_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("messages_sent", (from, to) =>
      supabase
        .from("messages")
        .select("*")
        .eq("sender_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("reviews_written", (from, to) =>
      supabase
        .from("reviews")
        .select("*")
        .eq("client_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("reviews_received", (from, to) =>
      supabase
        .from("reviews")
        .select("*")
        .eq("photographer_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    // Composite PK (user_id, photographer_id); user_id is fixed to the caller,
    // so photographer_id alone is a total order over this result set.
    fetchAllRows("favorites", (from, to) =>
      supabase
        .from("favorites")
        .select("*")
        .eq("user_id", user.id)
        .order("photographer_id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("reports", (from, to) =>
      supabase
        .from("reports")
        .select("*")
        .eq("reporter_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    // No "other party" column on disputes (only shoot_id + opened_by); RLS
    // ("disputes_select_participant") already scopes rows to disputes on
    // shoots the user is a party to (client or accepted photographer), so an
    // unfiltered select returns exactly what this user is entitled to.
    fetchAllRows("disputes", (from, to) =>
      supabase
        .from("disputes")
        .select("*")
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    // Composite PK (blocker_id, blocked_id); blocker_id is fixed to the caller.
    fetchAllRows("user_blocks", (from, to) =>
      supabase
        .from("user_blocks")
        .select("*")
        .eq("blocker_id", user.id)
        .order("blocked_id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("notifications", (from, to) =>
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
    fetchAllRows("shoot_invitations", (from, to) =>
      supabase
        .from("shoot_invitations")
        .select("*")
        .or(`client_id.eq.${user.id},photographer_id.eq.${user.id}`)
        .order("id", { ascending: true })
        .range(from, to)
    , incomplete),
  ]);

  return {
    ok: true,
    data: {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      // True when every dataset was read to the end. False names the ones that
      // were not, so the subject can ask for the rest instead of assuming this
      // is everything.
      export_complete: incomplete.length === 0,
      incomplete_datasets: incomplete,
      profile: profile.data,
      photographer_details: details.data,
      unavailable_dates: unavailable,
      shoots,
      bids,
      messages_sent: messages,
      reviews_written: reviewsWritten,
      reviews_received: reviewsReceived,
      favorites,
      reports,
      disputes,
      user_blocks: userBlocks,
      notifications,
      shoot_invitations: shootInvitations,
    },
  };
}
