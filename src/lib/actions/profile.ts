"use server";

import { z } from "zod";
import { dbError } from "@/lib/action-error";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { captureError } from "@/lib/observability";
import { getSessionUser } from "@/lib/auth";
import { CANTONS } from "@/lib/validation/photographer";

type ErrResult = { ok: false; error: string };
type Ok<T extends object = object> = { ok: true } & T;

const profileBasicsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  canton: z.enum(CANTONS).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
});

/**
 * Update the current user's public basics — display name, city, canton, bio.
 * These render on the header, the public photographer profile and directory
 * cards, but had no setter anywhere (registration/onboarding never collected
 * them), so they were permanently blank. RLS scopes the write to the own row;
 * the profiles UPDATE grant is column-scoped to exactly these columns.
 */
export async function updateProfileBasics(
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = profileBasicsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      city: parsed.data.city ? parsed.data.city : null,
      canton: parsed.data.canton ? parsed.data.canton : null,
      bio: parsed.data.bio ? parsed.data.bio : null,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: dbError(error, "profile") };

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidatePath("/[locale]/(public)/photographers/[id]", "page");
  revalidateTag(`photographer:${user.id}`, "max");
  return { ok: true };
}

function extFor(file: File): string {
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

function isStoragePath(value: string): boolean {
  return !value.startsWith("http://") && !value.startsWith("https://");
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/** Remove every object under `prefix` (recursively). Throws on any error. */
async function removeStorageFolder(admin: AdminClient, bucket: string, prefix: string) {
  const paths = await collectStoragePaths(admin, bucket, prefix);
  if (paths.length === 0) return;
  const { error } = await admin.storage.from(bucket).remove(paths);
  if (error) throw error;
}

/**
 * Recursively collect every object path under a storage prefix. Storage `list`
 * returns nested folders as entries with a null id; we descend into them so
 * nested objects (e.g. `<uid>/cover/...`, `<uid>/<shootId>/...`) are not left
 * behind. Throws on any listing error so the caller can fail safe.
 */
async function collectStoragePaths(
  admin: AdminClient,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const { data, error } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  if (error) throw error;
  const out: string[] = [];
  for (const entry of data ?? []) {
    const full = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      out.push(...(await collectStoragePaths(admin, bucket, full)));
    } else {
      out.push(full);
    }
  }
  return out;
}

/**
 * Upload (or replace) the current user's avatar. Stored at
 * `avatars/<uid>/<uuid>.<ext>`; the previous avatar object is removed so we
 * don't leave orphans in storage. Returns the public URL.
 */
export async function uploadAvatar(
  formData: FormData
): Promise<Ok<{ url: string }> | ErrResult> {
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

  // Capture the existing avatar so we can clean it up after a successful swap.
  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();
  const oldPath =
    current?.avatar_url && isStoragePath(current.avatar_url)
      ? current.avatar_url
      : null;

  const path = `${user.id}/${crypto.randomUUID()}.${extFor(file)}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: false, error: dbError(uploadError, "profile") };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", user.id);
  if (updateError) {
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, error: dbError(updateError, "profile") };
  }

  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidatePath("/[locale]/(app)/home", "page");
  revalidateTag(`photographer:${user.id}`, "max");

  return { ok: true, url: urlData.publicUrl };
}

const SUBSCRIPTION_ENDED = new Set(["canceled", "incomplete_expired"]);

/**
 * Cancel every Stripe subscription of this user that can still charge.
 * Stripe is the source of truth (our row can lag behind a webhook), and the
 * customer may hold more than the subscription on file: an older past_due
 * one survives a re-checkout, and a new one may exist before its webhook
 * landed. With a customer id we list them all; otherwise we check the one id
 * we have. Ids Stripe does not know (e.g. from the test-mode period) bill
 * nothing in this account: we proceed but report it. Any other failure
 * throws, and the caller aborts the deletion.
 */
async function cancelLiveSubscriptions(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  ref: { customerId: string | null; subscriptionId: string | null },
  userId: string
): Promise<void> {
  let live: string[] = [];
  try {
    if (ref.customerId) {
      const { data } = await stripe.subscriptions.list({
        customer: ref.customerId,
        status: "all",
        limit: 100,
      });
      live = data.filter((s) => !SUBSCRIPTION_ENDED.has(s.status)).map((s) => s.id);
    } else if (ref.subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(ref.subscriptionId);
      if (!SUBSCRIPTION_ENDED.has(sub.status)) live = [sub.id];
    }
  } catch (err) {
    if ((err as { code?: unknown })?.code !== "resource_missing") throw err;
    captureError(err, { scope: "profile.deleteAccount.stripeMissing", userId });
    return;
  }
  for (const id of live) await stripe.subscriptions.cancel(id);
}

/**
 * Permanently delete the current user's account and all associated data
 * (revFADP right to erasure). Deleting the auth user cascades through every
 * table via the `on delete cascade` foreign keys on profiles. Requires the
 * service-role key; returns an error if it is not configured.
 */
export async function deleteAccount(): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "generic" };

  // 1. Billing first, before anything is deleted. A live paid subscription
  // must never be orphaned behind a deleted account (no one could reach it
  // to cancel, and the card keeps being charged), so any failure here aborts
  // the deletion while every file and row is still intact and the user can
  // simply retry. No row, no Stripe ids, or Stripe not configured (local
  // dev/test) means there is nothing to cancel.
  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  // Fail-safe on a transient READ error: never proceed as if there were no
  // subscription.
  if (subError) {
    captureError(subError, { scope: "profile.deleteAccount.subRead", userId: user.id });
    return { ok: false, error: "billing_cancel_failed" };
  }
  if (sub?.stripe_subscription_id || sub?.stripe_customer_id) {
    const stripe = getStripe();
    if (stripe) {
      try {
        await cancelLiveSubscriptions(
          stripe,
          { customerId: sub.stripe_customer_id ?? null, subscriptionId: sub.stripe_subscription_id ?? null },
          user.id
        );
      } catch (err) {
        captureError(err, { scope: "profile.deleteAccount.stripeCancel", userId: user.id });
        return { ok: false, error: "billing_cancel_failed" };
      }
    }
  }

  // 2. Files. avatars/portfolio/shoot-refs live under the user's uid folder
  // (possibly nested). Chat photos live under message-images/<conversation>/:
  // the user's conversations and their messages cascade with the account, so
  // their photos go too. Any listing/removal error aborts BEFORE the auth user
  // is deleted, so no PII is left behind without an account to retry from.
  try {
    for (const bucket of ["avatars", "portfolio", "shoot-refs"]) {
      await removeStorageFolder(admin, bucket, user.id);
    }
    const { data: conversations, error: convError } = await admin
      .from("conversations")
      .select("id")
      .or(`client_id.eq.${user.id},photographer_id.eq.${user.id}`);
    if (convError) throw convError;
    for (const conversation of conversations ?? []) {
      await removeStorageFolder(admin, "message-images", conversation.id);
    }
  } catch {
    return { ok: false, error: "storage_cleanup_failed" };
  }

  // Record the erasure before it happens (audit_log.actor_id is ON DELETE SET
  // NULL, so the row survives the cascade as an anonymised audit entry).
  await admin.from("audit_log").insert({
    actor_id: user.id,
    action: "account_deleted",
    target_type: "profile",
    target_id: user.id,
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: dbError(error, "profile") };

  // Tear down the now-orphaned session cookies.
  const supabase = await createClient();
  await supabase.auth.signOut();

  return { ok: true };
}

/** Remove the current user's avatar (storage object + profile column). */
export async function removeAvatar(): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (error) return { ok: false, error: dbError(error, "profile") };

  if (current?.avatar_url && isStoragePath(current.avatar_url)) {
    await supabase.storage.from("avatars").remove([current.avatar_url]);
  }

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidatePath("/[locale]/(app)/home", "page");
  revalidateTag(`photographer:${user.id}`, "max");

  return { ok: true };
}
