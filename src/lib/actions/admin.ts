"use server";

import { dbError } from "@/lib/action-error";
import { revalidatePath, revalidateTag } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { addMonthsUtc } from "@/lib/billing/dates";
import { ENTITLED_STRIPE_STATUSES } from "@/lib/billing/plans";

type ErrResult = { ok: false; error: string };
type Ok = { ok: true };

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function requireAdmin() {
  const profile = await getProfile();
  if (!profile?.is_admin) return null;
  return profile;
}

/** Append an immutable audit-log row (service role; never throws into caller). */
async function writeAudit(
  admin: AdminClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta: Record<string, Json> = {}
) {
  await admin
    .from("audit_log")
    .insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, meta });
}

export async function updateReportStatus(
  reportId: string,
  status: "open" | "reviewed" | "dismissed",
  note?: string
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const trimmedNote = note?.trim() ? note.trim().slice(0, 1000) : null;
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      admin_note: trimmedNote,
    })
    .eq("id", reportId);
  if (error) return { ok: false, error: dbError(error, "admin") };

  await writeAudit(supabase, admin.id, `report_${status}`, "report", reportId, {
    note: trimmedNote,
  });

  revalidatePath("/[locale]/(admin)/admin", "page");
  return { ok: true };
}

export async function setUserSuspension(
  userId: string,
  suspend: boolean,
  reason?: string
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  if (userId === admin.id) return { ok: false, error: "cannot_suspend_self" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  // Never suspend another admin (avoids operators locking each other out).
  const { data: target } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "not_found" };
  if (target.is_admin) return { ok: false, error: "cannot_suspend_admin" };

  const trimmedReason =
    suspend && reason?.trim() ? reason.trim().slice(0, 500) : null;
  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: suspend,
      suspension_reason: trimmedReason,
      suspended_at: suspend ? new Date().toISOString() : null,
    })
    .eq("id", userId);
  if (error) return { ok: false, error: dbError(error, "admin") };

  await writeAudit(
    supabase,
    admin.id,
    suspend ? "user_suspended" : "user_unsuspended",
    "profile",
    userId,
    { reason: trimmedReason }
  );

  revalidatePath("/[locale]/(admin)/admin", "page");
  return { ok: true };
}

export async function setShootSuspension(
  shootId: string,
  suspend: boolean,
  reason?: string
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const trimmedReason =
    suspend && reason?.trim() ? reason.trim().slice(0, 500) : null;
  const { error } = await supabase
    .from("shoots")
    .update({ is_suspended: suspend, suspended_reason: trimmedReason })
    .eq("id", shootId);
  if (error) return { ok: false, error: dbError(error, "admin") };

  await writeAudit(
    supabase,
    admin.id,
    suspend ? "shoot_suspended" : "shoot_unsuspended",
    "shoot",
    shootId,
    { reason: trimmedReason }
  );

  revalidatePath("/[locale]/(admin)/admin", "page");
  return { ok: true };
}

export async function setPhotographerVerification(
  photographerId: string,
  status: "verified" | "rejected",
  note?: string
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const { error } = await supabase
    .from("photographer_details")
    .update({ verification_status: status })
    .eq("profile_id", photographerId);
  if (error) return { ok: false, error: dbError(error, "admin") };

  await writeAudit(
    supabase,
    admin.id,
    `photographer_${status}`,
    "profile",
    photographerId,
    { note: note?.trim() ? note.trim().slice(0, 1000) : null }
  );

  // The public profile is cached per-photographer; refresh it so the badge
  // updates immediately.
  revalidateTag(`photographer:${photographerId}`, "max");
  revalidatePath("/[locale]/(admin)/admin", "page");
  return { ok: true };
}

export async function setUserAdmin(
  userId: string,
  makeAdmin: boolean
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  // An admin must not revoke their own admin (avoids locking out the last one).
  if (userId === admin.id && !makeAdmin)
    return { ok: false, error: "cannot_revoke_self" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: makeAdmin })
    .eq("id", userId);
  if (error) return { ok: false, error: dbError(error, "admin") };

  await writeAudit(
    supabase,
    admin.id,
    makeAdmin ? "admin_granted" : "admin_revoked",
    "profile",
    userId
  );

  revalidatePath("/[locale]/(admin)/admin/users", "page");
  return { ok: true };
}

export async function resolveDispute(
  id: string,
  status: "resolved" | "dismissed",
  note?: string
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const trimmedNote = note?.trim() ? note.trim().slice(0, 2000) : null;
  const { error } = await supabase
    .from("disputes")
    .update({
      status,
      resolution_note: trimmedNote,
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: dbError(error, "admin") };

  await writeAudit(supabase, admin.id, `dispute_${status}`, "dispute", id, {
    note: trimmedNote,
  });

  revalidatePath("/[locale]/(admin)/admin/disputes", "page");
  return { ok: true };
}

export async function grantComp(
  userId: string,
  plan: "basic" | "standard" | "premium",
  months: number,
  note?: string
): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  if (
    !["basic", "standard", "premium"].includes(plan) ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 24
  ) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { ok: false, error: "not_found" };
  if (target.role !== "photographer") return { ok: false, error: "not_photographer" };

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("source, status, current_period_end, comp_until, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    existing &&
    existing.source === "stripe" &&
    (ENTITLED_STRIPE_STATUSES as readonly string[]).includes(existing.status) &&
    existing.current_period_end &&
    new Date(existing.current_period_end) > new Date()
  ) {
    return { ok: false, error: "comp_conflicts_stripe" };
  }

  const now = new Date();
  const compUntil = addMonthsUtc(now, months);
  const trimmedNote = note?.trim() ? note.trim().slice(0, 1000) : null;

  // Omit stripe columns so an existing dead-stripe mapping is preserved on
  // conflict — PostgREST only updates columns present in the payload, and on
  // a fresh insert the omitted stripe cols default to null.
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status: "comp",
      source: "admin_comp",
      comp_until: compUntil.toISOString(),
      granted_by: admin.id,
      note: trimmedNote,
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: dbError(error, "admin") };

  const { error: detailsError } = await supabase
    .from("photographer_details")
    .update({ plan_tier: plan, plan_expires_at: compUntil.toISOString() })
    .eq("profile_id", userId);
  if (detailsError) return { ok: false, error: dbError(detailsError, "admin") };

  // Re-grant simply extends — no separate action needed; previous_until
  // records the prior state in the audit trail.
  await writeAudit(supabase, admin.id, "comp_granted", "profile", userId, {
    plan,
    until: compUntil.toISOString(),
    months,
    note: trimmedNote,
    previous_until: existing?.comp_until ?? null,
  });

  revalidatePath("/[locale]/(admin)/admin/users", "page");
  revalidateTag("photographers-directory", "max");
  revalidateTag(`photographer:${userId}`, "max");
  return { ok: true };
}

export async function revokeComp(userId: string): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("source")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "not_found" };
  // Never touch a stripe row here.
  if (existing.source !== "admin_comp") return { ok: false, error: "not_comp" };

  const now = new Date();
  // status stays 'comp' (keeps source_shape valid); comp_until now-or-past
  // makes effectivePlan return free.
  const { error } = await supabase
    .from("subscriptions")
    .update({ comp_until: now.toISOString(), updated_at: now.toISOString() })
    .eq("user_id", userId);
  if (error) return { ok: false, error: dbError(error, "admin") };

  const { error: detailsError } = await supabase
    .from("photographer_details")
    .update({ plan_tier: "free", plan_expires_at: null })
    .eq("profile_id", userId);
  if (detailsError) return { ok: false, error: dbError(detailsError, "admin") };

  await writeAudit(supabase, admin.id, "comp_revoked", "profile", userId);

  revalidatePath("/[locale]/(admin)/admin/users", "page");
  revalidateTag("photographers-directory", "max");
  revalidateTag(`photographer:${userId}`, "max");
  return { ok: true };
}

export async function retryFailedEmail(id: number): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  // Reset a failed row so the next cron run picks it up again.
  const { error } = await supabase
    .from("email_outbox")
    .update({ status: "pending", attempts: 0, last_error: null })
    .eq("id", id)
    .eq("status", "failed");
  if (error) return { ok: false, error: dbError(error, "admin") };

  revalidatePath("/[locale]/(admin)/admin/email", "page");
  return { ok: true };
}
