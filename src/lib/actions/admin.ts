"use server";

import { z } from "zod";
import { dbError } from "@/lib/action-error";
import { captureError } from "@/lib/observability";
import { revalidatePath, revalidateTag } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { addMonthsUtc } from "@/lib/billing/dates";
import { ENTITLED_STRIPE_STATUSES } from "@/lib/billing/plans";
import { notifyEmail } from "@/lib/email";

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

  revalidateShootSurfaces();
  return { ok: true };
}

/**
 * Moderation must take effect at once: the landing page caches its "latest
 * open shoots" (tag `shoots:open`) for up to a minute, and a shoot an admin
 * just hid or deleted must not stay its hero image for that minute. `expire: 0`
 * makes the next visit refetch instead of being served the stale list.
 */
function revalidateShootSurfaces() {
  revalidateTag("shoots:open", { expire: 0 });
  revalidatePath("/[locale]/(admin)/admin", "page");
  revalidatePath("/[locale]/(admin)/admin/shoots", "page");
}

/**
 * Permanently removes a shoot (admin only). Bids, invitations, notifications,
 * conversations and image rows go with it (all FKs to shoots cascade); the
 * image files and still-queued emails about it are cleaned up here.
 *
 * A booked shoot (accepted bid) or one with a dispute is refused: the two
 * parties' booking, messages and dispute record must survive. Those can only
 * be hidden (setShootSuspension).
 */
export async function deleteShoot(shootId: string): Promise<Ok | ErrResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "forbidden" };
  if (!z.string().uuid().safeParse(shootId).success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = createAdminClient();
  if (!supabase) return { ok: false, error: "generic" };

  const { data: shoot, error: readError } = await supabase
    .from("shoots")
    .select("id, title, client_id, status, accepted_bid_id")
    .eq("id", shootId)
    .maybeSingle();
  if (readError) return { ok: false, error: dbError(readError, "admin") };
  if (!shoot) return { ok: false, error: "not_found" };
  if (shoot.accepted_bid_id) return { ok: false, error: "shoot_not_deletable" };

  const { count: disputeCount, error: disputeError } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("shoot_id", shootId);
  if (disputeError) return { ok: false, error: dbError(disputeError, "admin") };
  if ((disputeCount ?? 0) > 0) return { ok: false, error: "shoot_not_deletable" };

  // Read the file paths before the rows cascade away with the shoot.
  const { data: images, error: imagesError } = await supabase
    .from("shoot_images")
    .select("storage_path")
    .eq("shoot_id", shootId);
  if (imagesError) return { ok: false, error: dbError(imagesError, "admin") };
  const paths = (images ?? []).map((image) => image.storage_path);

  const { error: deleteError } = await supabase.from("shoots").delete().eq("id", shootId);
  if (deleteError) return { ok: false, error: dbError(deleteError, "admin") };

  // The shoot is gone; what follows is cleanup and must not turn a completed
  // removal into an error for the admin.
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("shoot-refs").remove(paths);
    if (storageError) {
      captureError(storageError, { scope: "admin.deleteShoot.storage" });
    }
  }
  // Queued notifications about it would link to a page that no longer exists.
  await supabase
    .from("email_outbox")
    .delete()
    .eq("shoot_id", shootId)
    .eq("status", "pending");

  await writeAudit(supabase, admin.id, "shoot_deleted", "shoot", shootId, {
    title: shoot.title,
    client_id: shoot.client_id,
    images: paths.length,
  });

  revalidateShootSurfaces();
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

  // Tell the photographer (plan + end date are read when the email is sent).
  // The window keeps a double-click — or grant-then-fix within minutes — to
  // one email.
  await notifyEmail({
    kind: "comp_granted",
    recipientId: userId,
    dedupeWindowMs: 10 * 60 * 1000,
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
