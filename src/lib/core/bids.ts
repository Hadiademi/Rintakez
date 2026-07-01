import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/action-error";

export type BidResult = { ok: true } | { ok: false; error: string };

export type SubmitBidInput = {
  shootId: string;
  amountChf: number;
  message: string;
};

/**
 * Places or revives a photographer's bid via the submit_bid RPC. Framework-
 * agnostic: the caller supplies an authenticated Supabase client, so the same
 * function serves the web server action today and a native client later.
 */
export async function submitBid(
  supabase: SupabaseClient,
  input: SubmitBidInput
): Promise<BidResult> {
  const { error } = await supabase.rpc("submit_bid", {
    p_shoot_id: input.shootId,
    p_amount_chf: input.amountChf,
    p_message: input.message,
  });
  if (error) {
    if (error.message.includes("already_bid")) {
      return { ok: false, error: "already_bid" };
    }
    return { ok: false, error: dbError(error, "bids") };
  }
  return { ok: true };
}
