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
    reports,
    disputes,
    userBlocks,
    notifications,
    shootInvitations,
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
    supabase.from("reports").select("*").eq("reporter_id", user.id),
    // No "other party" column on disputes (only shoot_id + opened_by); RLS
    // ("disputes_select_participant") already scopes rows to disputes on
    // shoots the user is a party to (client or accepted photographer), so an
    // unfiltered select returns exactly what this user is entitled to.
    supabase.from("disputes").select("*"),
    supabase.from("user_blocks").select("*").eq("blocker_id", user.id),
    supabase.from("notifications").select("*").eq("user_id", user.id),
    supabase
      .from("shoot_invitations")
      .select("*")
      .or(`client_id.eq.${user.id},photographer_id.eq.${user.id}`),
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
      reports: reports.data ?? [],
      disputes: disputes.data ?? [],
      user_blocks: userBlocks.data ?? [],
      notifications: notifications.data ?? [],
      shoot_invitations: shootInvitations.data ?? [],
    },
  };
}
