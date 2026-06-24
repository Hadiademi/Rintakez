"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

type ErrResult = { ok: false; error: string };

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function addUnavailableDate(
  date: string
): Promise<{ ok: true } | ErrResult> {
  if (!dateSchema.safeParse(date).success)
    return { ok: false, error: "invalid_input" };

  const profile = await getProfile();
  if (!profile || profile.role !== "photographer")
    return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("photographer_unavailable")
    .insert({ photographer_id: profile.id, date });
  // 23505 = the date is already blocked, which is the desired end state.
  if (error && error.code !== "23505")
    return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidateTag(`photographer:${profile.id}`, "max");
  return { ok: true };
}

export async function removeUnavailableDate(
  date: string
): Promise<{ ok: true } | ErrResult> {
  if (!dateSchema.safeParse(date).success)
    return { ok: false, error: "invalid_input" };

  const profile = await getProfile();
  if (!profile || profile.role !== "photographer")
    return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("photographer_unavailable")
    .delete()
    .eq("photographer_id", profile.id)
    .eq("date", date);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/profile", "page");
  revalidateTag(`photographer:${profile.id}`, "max");
  return { ok: true };
}
