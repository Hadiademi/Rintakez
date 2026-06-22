"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

type ErrResult = { ok: false; error: string };

/**
 * Data Subject Access Request (revFADP Art. 25 / GDPR Art. 15): return all
 * personal data held about the current user, in machine-readable JSON. Reads run
 * through the user's own RLS-scoped client, so the result is exactly the data
 * they are entitled to.
 */
export async function exportMyData(): Promise<
  { ok: true; data: Record<string, unknown> } | ErrResult
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();

  const [
    profile,
    details,
    unavailable,
    shoots,
    bids,
    messages,
    reviewsWritten,
    reviewsReceived,
    favorites,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("photographer_details")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase
      .from("photographer_unavailable")
      .select("*")
      .eq("photographer_id", user.id),
    supabase.from("shoots").select("*").eq("client_id", user.id),
    supabase.from("bids").select("*").eq("photographer_id", user.id),
    supabase.from("messages").select("*").eq("sender_id", user.id),
    supabase.from("reviews").select("*").eq("client_id", user.id),
    supabase.from("reviews").select("*").eq("photographer_id", user.id),
    supabase.from("favorites").select("*").eq("user_id", user.id),
  ]);

  return {
    ok: true,
    data: {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      profile: profile.data,
      photographer_details: details.data,
      unavailable_dates: unavailable.data ?? [],
      shoots: shoots.data ?? [],
      bids: bids.data ?? [],
      messages_sent: messages.data ?? [],
      reviews_written: reviewsWritten.data ?? [],
      reviews_received: reviewsReceived.data ?? [],
      favorites: favorites.data ?? [],
    },
  };
}
