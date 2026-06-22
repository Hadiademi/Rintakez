"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

type ErrResult = { ok: false; error: string };

const prefsSchema = z.object({
  notifyBids: z.boolean(),
  notifyShootUpdates: z.boolean(),
});

/** Update the current user's email notification preferences (own row only). */
export async function updateNotificationPrefs(
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = prefsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      notify_bids: parsed.data.notifyBids,
      notify_shoot_updates: parsed.data.notifyShootUpdates,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/profile", "page");
  return { ok: true };
}
