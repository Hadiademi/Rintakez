"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { createShootSchema } from "@/lib/validation/shoot";
import { notifyEmail, type EmailKind } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

type ErrResult = { ok: false; error: string };

/** Email the photographer of a bid after its status changed (best-effort). */
async function emailBidOutcome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bidId: string,
  kind: EmailKind
) {
  const { data: bid } = await supabase
    .from("bids")
    .select("photographer_id, shoot_id")
    .eq("id", bidId)
    .maybeSingle();
  if (!bid) return;
  const { data: shoot } = await supabase
    .from("shoots")
    .select("title")
    .eq("id", bid.shoot_id)
    .maybeSingle();
  await notifyEmail({
    kind,
    recipientId: bid.photographer_id,
    shootId: bid.shoot_id,
    shootTitle: shoot?.title ?? null,
  });
}

const MAX_SHOOT_IMAGES = 6;

function imageExt(file: File): string {
  const rawExt = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  const fromMime =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "bin";
  return /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : fromMime;
}

export async function createShootAction(
  raw: unknown
): Promise<{ ok: true; id: string } | ErrResult> {
  const parsed = createShootSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const profile = await getProfile();
  if (!profile || profile.role !== "client")
    return { ok: false, error: "forbidden" };
  if (!(await rateLimit(`shoot:${user.id}`, 10, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shoots")
    .insert({
      client_id: user.id,
      title: v.title,
      type: v.type,
      brief: v.brief,
      location_city: v.locationCity,
      location_postcode: v.locationPostcode || null,
      canton: v.canton,
      shoot_date: v.shootDate,
      duration_hours: v.durationHours,
      budget_min_chf: v.budgetMinChf,
      budget_max_chf: v.budgetMaxChf,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "insert_failed" };

  revalidatePath("/[locale]/(app)/my-shoots", "page");
  revalidatePath("/[locale]/(app)/home", "page");

  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Reference images — optional inspiration photos attached to a shoot brief.
// ---------------------------------------------------------------------------
export async function addShootImage(
  shootId: string,
  formData: FormData
): Promise<{ ok: true; id: string; url: string } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const file = formData.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    !file.type.startsWith("image/") ||
    file.size > 5 * 1024 * 1024
  ) {
    return { ok: false, error: "invalid_file" };
  }

  const supabase = await createClient();

  // Ownership guard (RLS also enforces this; fail fast with a clear error).
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id")
    .eq("id", shootId)
    .eq("client_id", user.id)
    .maybeSingle();
  if (!shoot) return { ok: false, error: "forbidden" };

  const { count } = await supabase
    .from("shoot_images")
    .select("id", { count: "exact", head: true })
    .eq("shoot_id", shootId);
  if ((count ?? 0) >= MAX_SHOOT_IMAGES)
    return { ok: false, error: "limit_reached" };

  const path = `${user.id}/${shootId}/${crypto.randomUUID()}.${imageExt(file)}`;

  const { error: uploadError } = await supabase.storage
    .from("shoot-refs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: inserted, error: insertError } = await supabase
    .from("shoot_images")
    .insert({ shoot_id: shootId, storage_path: path })
    .select("id")
    .single();

  if (insertError || !inserted) {
    await supabase.storage.from("shoot-refs").remove([path]);
    return { ok: false, error: insertError?.message ?? "insert_failed" };
  }

  // Private bucket: return a short-lived signed URL for the immediate preview.
  const { data: signed } = await supabase.storage
    .from("shoot-refs")
    .createSignedUrl(path, 3600);

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");

  return { ok: true, id: inserted.id, url: signed?.signedUrl ?? "" };
}

export async function removeShootImage(
  imageId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("shoot_images")
    .select("id, storage_path, shoot_id")
    .eq("id", imageId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };

  // Confirm the caller owns the parent shoot.
  const { data: shoot } = await supabase
    .from("shoots")
    .select("id")
    .eq("id", row.shoot_id)
    .eq("client_id", user.id)
    .maybeSingle();
  if (!shoot) return { ok: false, error: "not_found" };

  await supabase.storage.from("shoot-refs").remove([row.storage_path]);

  const { error: deleteError } = await supabase
    .from("shoot_images")
    .delete()
    .eq("id", imageId);
  if (deleteError) return { ok: false, error: deleteError.message };

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  return { ok: true };
}

export async function acceptBidAction(
  bidId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_bid", { p_bid_id: bidId });
  if (error) return { ok: false, error: error.message };

  await emailBidOutcome(supabase, bidId, "bid_accepted");

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/my-shoots", "page");
  return { ok: true };
}

export async function declineBidAction(
  bidId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_bid", { p_bid_id: bidId });
  if (error) return { ok: false, error: error.message };

  await emailBidOutcome(supabase, bidId, "bid_declined");

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/my-shoots", "page");
  return { ok: true };
}

export async function completeShootAction(
  shootId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_shoot", {
    p_shoot_id: shootId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/my-shoots", "page");
  return { ok: true };
}

export async function cancelShootAction(
  shootId: string,
  reason?: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  // Scope the update to the owner AND surface a clear "forbidden" when nothing
  // matched (a non-owner's update silently affects 0 rows otherwise — RLS still
  // blocks it, but the caller must not see a misleading success).
  const { data, error } = await supabase
    .from("shoots")
    .update({
      status: "cancelled",
      cancellation_reason: reason?.trim() ? reason.trim().slice(0, 500) : null,
    })
    .eq("id", shootId)
    .eq("client_id", user.id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/my-shoots", "page");
  return { ok: true };
}
