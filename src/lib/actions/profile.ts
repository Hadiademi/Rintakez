"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";

type ErrResult = { ok: false; error: string };
type Ok<T extends object = object> = { ok: true } & T;

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
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", user.id);
  if (updateError) {
    await supabase.storage.from("avatars").remove([path]);
    return { ok: false, error: updateError.message };
  }

  if (oldPath) await supabase.storage.from("avatars").remove([oldPath]);

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidatePath("/[locale]/(app)/home", "page");
  revalidateTag(`photographer:${user.id}`, "max");

  return { ok: true, url: urlData.publicUrl };
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

  // Best-effort storage cleanup (avatars/portfolio/shoot-refs live under the
  // user's uid folder); DB rows cascade from the auth.users delete.
  for (const bucket of ["avatars", "portfolio", "shoot-refs"]) {
    const { data: files } = await admin.storage.from(bucket).list(user.id);
    if (files?.length) {
      await admin.storage
        .from(bucket)
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, error: error.message };

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
  if (error) return { ok: false, error: error.message };

  if (current?.avatar_url && isStoragePath(current.avatar_url)) {
    await supabase.storage.from("avatars").remove([current.avatar_url]);
  }

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidatePath("/[locale]/(app)/home", "page");
  revalidateTag(`photographer:${user.id}`, "max");

  return { ok: true };
}
