"use server";

import { dbError } from "@/lib/action-error";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { replyToReviewSchema } from "@/lib/validation/review";

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
    return { ok: false, error: dbError(error, "reviews") };
  }

  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/home", "page");
  return { ok: true };
}

export async function replyToReview(
  reviewId: string,
  raw: unknown
): Promise<{ ok: true } | ErrResult> {
  const parsed = replyToReviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };

  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await rateLimit(`review-reply:${user.id}`, 20, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();

  // The reviewed photographer may set the reply once. RLS enforces both the
  // ownership (photographer_id = auth.uid()) and settable-once (reply is null)
  // guarantees, so a forbidden or second reply simply matches zero rows — we
  // detect that via the returned rows and surface a stable error.
  const { data, error } = await supabase
    .from("reviews")
    .update({
      reply: parsed.data.text,
      reply_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("photographer_id", user.id)
    .is("reply", null)
    .select("id");

  if (error) return { ok: false, error: dbError(error, "reviews") };
  if (!data || data.length === 0) return { ok: false, error: "forbidden" };

  // The public profile page is unstable_cache'd under `photographer:${id}`.
  revalidateTag(`photographer:${user.id}`, "max");
  revalidatePath("/[locale]/(app)/photographers/[id]", "page");
  revalidatePath("/[locale]/(app)/profile", "page");
  return { ok: true };
}
