"use server";

import { dbError } from "@/lib/action-error";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { routing, type Locale } from "@/i18n/routing";

type ErrResult = { ok: false; error: string };

const prefsSchema = z.object({
  notifyBids: z.boolean(),
  notifyShootUpdates: z.boolean(),
  notifyMessages: z.boolean(),
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
      notify_messages: parsed.data.notifyMessages,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: dbError(error, "settings") };

  revalidatePath("/[locale]/(app)/profile", "page");
  return { ok: true };
}

/**
 * Persist the site language as the signed-in user's language for emails,
 * notifications and Stripe return URLs (profiles.locale). Called by the
 * language switcher; a no-op for visitors who are not signed in.
 */
export async function setPreferredLocale(
  locale: string
): Promise<{ ok: true; saved: boolean } | ErrResult> {
  if (typeof locale !== "string" || !(routing.locales as readonly string[]).includes(locale)) {
    return { ok: false, error: "invalid_input" };
  }

  const user = await getSessionUser();
  if (!user) return { ok: true, saved: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ locale: locale as Locale })
    .eq("id", user.id);
  if (error) return { ok: false, error: dbError(error, "settings") };

  return { ok: true, saved: true };
}
