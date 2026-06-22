"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

type ErrResult = { ok: false; error: string };

const disputeSchema = z.object({ reason: z.string().min(10).max(2000) });

/** A shoot participant raises a dispute (RLS enforces participant + shoot state). */
export async function openDispute(
  shootId: string,
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = disputeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`dispute:${user.id}`, 5, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  const { error } = await supabase.from("disputes").insert({
    shoot_id: shootId,
    opened_by: user.id,
    reason: parsed.data.reason.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  return { ok: true };
}
