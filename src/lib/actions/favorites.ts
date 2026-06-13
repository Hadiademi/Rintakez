"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

type ErrResult = { ok: false; error: string };

/** Toggle a saved photographer for the current user. Returns the new state. */
export async function toggleFavorite(
  photographerId: string
): Promise<{ ok: true; favorited: boolean } | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("favorites")
    .select("photographer_id")
    .eq("user_id", user.id)
    .eq("photographer_id", photographerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("photographer_id", photographerId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/[locale]/(app)/photographers", "page");
    return { ok: true, favorited: false };
  }

  const { error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, photographer_id: photographerId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/[locale]/(app)/photographers", "page");
  return { ok: true, favorited: true };
}
