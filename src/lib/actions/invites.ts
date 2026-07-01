"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invitePhotographer } from "@/lib/core/invites";

type ErrResult = { ok: false; error: string };
type Ok = { ok: true };

export async function invitePhotographerAction(
  photographerId: string,
  shootId: string
): Promise<Ok | ErrResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "unauthorized" };
  // Only clients invite (they own the shoots).
  if (profile.role !== "client") return { ok: false, error: "forbidden" };
  if (!(await rateLimit(`invite:${profile.id}`, 30, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  const result = await invitePhotographer(supabase, {
    photographerId,
    shootId,
    clientId: profile.id,
  });
  if (!result.ok) return result;

  revalidatePath("/[locale]/(app)/photographers/[id]", "page");
  revalidatePath("/[locale]/(app)/my-shoots", "page");
  return { ok: true };
}
