"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

type ErrResult = { ok: false; error: string };

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

export async function submitReviewAction(
  shootId: string,
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`review:${user.id}`, 10, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();

  // The shoot must be the caller's, completed, and have an accepted bid.
  const { data: shoot } = await supabase
    .from("shoots")
    .select("client_id, status, accepted_bid_id")
    .eq("id", shootId)
    .maybeSingle();

  if (
    !shoot ||
    shoot.client_id !== user.id ||
    shoot.status !== "completed" ||
    !shoot.accepted_bid_id
  ) {
    return { ok: false, error: "forbidden" };
  }

  const { data: bid } = await supabase
    .from("bids")
    .select("photographer_id")
    .eq("id", shoot.accepted_bid_id)
    .maybeSingle();
  if (!bid) return { ok: false, error: "not_found" };

  const { error } = await supabase.from("reviews").insert({
    shoot_id: shootId,
    client_id: user.id,
    photographer_id: bid.photographer_id,
    rating: parsed.data.rating,
    comment: parsed.data.comment?.trim() || null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_reviewed" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/home", "page");
  return { ok: true };
}
