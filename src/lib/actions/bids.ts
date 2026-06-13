"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { createBidSchema } from "@/lib/validation/bid";
import { notifyEmail } from "@/lib/email";

type ErrResult = { ok: false; error: string };
type Ok = { ok: true };

function revalidateBidViews() {
  revalidatePath("/[locale]/(app)/shoots/[id]", "page");
  revalidatePath("/[locale]/(app)/my-bids", "page");
}

export async function submitBidAction(shootId: string, raw: unknown): Promise<Ok | ErrResult> {
  const parsed = createBidSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase.from("bids").insert({
    shoot_id: shootId,
    photographer_id: user.id,
    amount_chf: parsed.data.amountChf,
    message: parsed.data.message,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_bid" };
    return { ok: false, error: error.message };
  }

  // Email the shoot's client (best-effort; gated on RESEND_API_KEY).
  const { data: shoot } = await supabase
    .from("shoots")
    .select("client_id, title")
    .eq("id", shootId)
    .maybeSingle();
  if (shoot) {
    await notifyEmail({
      kind: "bid_received",
      recipientId: shoot.client_id,
      shootId,
      shootTitle: shoot.title,
    });
  }

  revalidateBidViews();
  return { ok: true };
}

export async function updateBidAction(bidId: string, raw: unknown): Promise<Ok | ErrResult> {
  const parsed = createBidSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bids")
    .update({ amount_chf: parsed.data.amountChf, message: parsed.data.message })
    .eq("id", bidId)
    .eq("photographer_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateBidViews();
  return { ok: true };
}

export async function withdrawBidAction(bidId: string): Promise<Ok | ErrResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bids")
    .update({ status: "withdrawn" })
    .eq("id", bidId)
    .eq("photographer_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidateBidViews();
  return { ok: true };
}
