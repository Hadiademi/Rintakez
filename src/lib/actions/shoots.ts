"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getProfile } from "@/lib/auth";
import { createShootSchema } from "@/lib/validation/shoot";

type ErrResult = { ok: false; error: string };

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
