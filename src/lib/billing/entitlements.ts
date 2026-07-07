// Entitlement resolution — mirrors the src/lib/core/* convention: functions
// take a SupabaseClient (never call createClient themselves) so the same
// logic serves server actions, webhooks, and cron jobs alike.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ENTITLED_STRIPE_STATUSES, MONTHLY_BID_QUOTA, type Plan } from "./plans";
import { monthStartZurich } from "./zurich";

export type SubRow = {
  plan: Plan;
  status: string;
  source: "stripe" | "admin_comp";
  current_period_end: string | null;
  comp_until: string | null;
} | null;

export type Entitlement = {
  plan: Plan;
  isActive: boolean;
  source: "stripe" | "admin_comp" | null;
  expiresAt: Date | null;
};

const NOT_ENTITLED: Entitlement = {
  plan: "free",
  isActive: false,
  source: null,
  expiresAt: null,
};

/**
 * Pure resolution of a subscriptions row into the plan the user is currently
 * entitled to. Boundary is strict `>` — an expiry exactly equal to `now` reads
 * as already expired, never as still-active.
 */
export function effectivePlan(row: SubRow, now: Date): Entitlement {
  if (!row) return NOT_ENTITLED;

  if (row.source === "stripe") {
    const entitled =
      (ENTITLED_STRIPE_STATUSES as readonly string[]).includes(row.status) &&
      row.current_period_end !== null &&
      new Date(row.current_period_end) > now;
    if (entitled) {
      return {
        plan: row.plan,
        isActive: true,
        source: "stripe",
        expiresAt: new Date(row.current_period_end as string),
      };
    }
    return NOT_ENTITLED;
  }

  // source === 'admin_comp' — stripe fields (current_period_end/status) are
  // irrelevant leftovers here and must never be consulted.
  const entitled = row.comp_until !== null && new Date(row.comp_until) > now;
  if (entitled) {
    return {
      plan: row.plan,
      isActive: true,
      source: "admin_comp",
      expiresAt: new Date(row.comp_until as string),
    };
  }
  return NOT_ENTITLED;
}

export function monthlyQuota(plan: Plan): number {
  return MONTHLY_BID_QUOTA[plan];
}

async function fetchSubRow(supabase: SupabaseClient, userId: string): Promise<SubRow> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, source, current_period_end, comp_until")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SubRow) ?? null;
}

export async function getEntitlement(
  supabase: SupabaseClient,
  userId: string
): Promise<Entitlement> {
  const row = await fetchSubRow(supabase, userId);
  return effectivePlan(row, new Date());
}

export async function getBidQuotaUsage(
  supabase: SupabaseClient,
  userId: string,
  now: Date
): Promise<{ plan: Plan; used: number; limit: number }> {
  const row = await fetchSubRow(supabase, userId);
  const entitlement = effectivePlan(row, now);

  // Anti-gaming: count bids of ALL statuses (withdrawn included) created this
  // Zurich-calendar month — otherwise a photographer could submit, withdraw,
  // and resubmit to bypass their quota for free. This does mean a withdrawn
  // bid still counts against the same month's quota; the trade-off is bounded
  // because "revive withdrawn" (submitBidAction) updates the existing row
  // in place rather than inserting a new one, so it never double-counts.
  const { count } = await supabase
    .from("bids")
    .select("id", { count: "exact", head: true })
    .eq("photographer_id", userId)
    .gte("created_at", monthStartZurich(now).toISOString());

  return { plan: entitlement.plan, used: count ?? 0, limit: monthlyQuota(entitlement.plan) };
}
