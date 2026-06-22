"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

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
  if (error) return { ok: false, error: error.message };

  await writeAudit(supabase, admin.id, `report_${status}`, "report", reportId, {
    note: trimmedNote,
  });

  revalidatePath("/[locale]/(app)/admin", "page");
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
  if (error) return { ok: false, error: error.message };

  await writeAudit(
    supabase,
    admin.id,
    suspend ? "user_suspended" : "user_unsuspended",
    "profile",
    userId,
    { reason: trimmedReason }
  );

  revalidatePath("/[locale]/(app)/admin", "page");
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
  if (error) return { ok: false, error: error.message };

  await writeAudit(
    supabase,
    admin.id,
    suspend ? "shoot_suspended" : "shoot_unsuspended",
    "shoot",
    shootId,
    { reason: trimmedReason }
  );

  revalidatePath("/[locale]/(app)/admin", "page");
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
  if (error) return { ok: false, error: error.message };

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
  revalidatePath("/[locale]/(app)/admin", "page");
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
  if (error) return { ok: false, error: error.message };

  await writeAudit(
    supabase,
    admin.id,
    makeAdmin ? "admin_granted" : "admin_revoked",
    "profile",
    userId
  );

  revalidatePath("/[locale]/(app)/admin/users", "page");
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
  if (error) return { ok: false, error: error.message };

  await writeAudit(supabase, admin.id, `dispute_${status}`, "dispute", id, {
    note: trimmedNote,
  });

  revalidatePath("/[locale]/(app)/admin/disputes", "page");
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
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/admin/email", "page");
  return { ok: true };
}
