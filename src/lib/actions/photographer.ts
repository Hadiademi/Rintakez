"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import {
  photographerDetailsSchema,
  type PhotographerDetailsInput,
} from "@/lib/validation/photographer";

type OkResult<T extends object = object> = { ok: true } & T;
type ErrResult = { ok: false; error: string };
type ActionResult<T extends object = object> = OkResult<T> | ErrResult;

// ---------------------------------------------------------------------------
// 1. savePhotographerDetails
// ---------------------------------------------------------------------------
export async function savePhotographerDetails(
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = photographerDetailsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const profile = await getProfile();
  if (!profile || profile.role !== "photographer")
    return { ok: false, error: "forbidden" };

  const {
    specialties,
    coverageCantons,
    hourlyRateChf,
    websiteUrl,
    instagramUrl,
  }: PhotographerDetailsInput = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.from("photographer_details").upsert(
    {
      profile_id: user.id,
      specialties,
      coverage_cantons: coverageCantons,
      hourly_rate_chf: hourlyRateChf ?? null,
      website_url: websiteUrl || null,
      instagram_url: instagramUrl || null,
    },
    { onConflict: "profile_id" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/onboarding", "page");
  revalidatePath("/[locale]/(app)/home", "page");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 2. addPortfolioImage
// ---------------------------------------------------------------------------
export async function addPortfolioImage(
  formData: FormData
): Promise<ActionResult<{ id: string; path: string; url: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const profile = await getProfile();
  if (!profile || profile.role !== "photographer")
    return { ok: false, error: "forbidden" };

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

  // UX guard: cap at 20 images
  const { count } = await supabase
    .from("portfolio_images")
    .select("id", { count: "exact", head: true })
    .eq("photographer_id", user.id);

  if ((count ?? 0) >= 20) return { ok: false, error: "limit_reached" };

  // Derive extension. The filename is attacker-controlled, so only accept a
  // short alphanumeric ext; otherwise fall back to the MIME-derived one. This
  // keeps the storage key strictly `<uid>/<uuid>.<safe-ext>` (no traversal).
  const rawExt = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "";
  const extFromMime =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "bin";
  const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : extFromMime;

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("portfolio")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return { ok: false, error: uploadError.message };

  const { data: inserted, error: insertError } = await supabase
    .from("portfolio_images")
    .insert({ photographer_id: user.id, storage_path: path })
    .select("id")
    .single();

  if (insertError || !inserted) {
    // Attempt to clean up the orphaned storage object
    await supabase.storage.from("portfolio").remove([path]);
    return { ok: false, error: insertError?.message ?? "insert_failed" };
  }

  const { data: urlData } = supabase.storage
    .from("portfolio")
    .getPublicUrl(path);

  return { ok: true, id: inserted.id, path, url: urlData.publicUrl };
}

// ---------------------------------------------------------------------------
// 3. removePortfolioImage
// ---------------------------------------------------------------------------
export async function removePortfolioImage(
  imageId: string
): Promise<{ ok: true } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();

  const { data: row, error: fetchError } = await supabase
    .from("portfolio_images")
    .select("id, storage_path")
    .eq("id", imageId)
    .eq("photographer_id", user.id) // defensive: only own images
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "not_found" };

  const { error: storageError } = await supabase.storage
    .from("portfolio")
    .remove([row.storage_path]);

  if (storageError) return { ok: false, error: storageError.message };

  const { error: deleteError } = await supabase
    .from("portfolio_images")
    .delete()
    .eq("id", imageId)
    .eq("photographer_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  return { ok: true };
}
