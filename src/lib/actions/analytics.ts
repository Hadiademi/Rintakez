"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Records a profile view for the future (payment-gated) photographer
 * analytics dashboard — see supabase/migrations/20260701150000_profile_views.sql.
 * Best-effort and silent: called from a tiny client component on mount so it
 * never blocks or delays the profile page's render, and works for both
 * anonymous and signed-in viewers (record_profile_view reads auth.uid()
 * itself, which is null for anon). Self-views and non-photographer targets
 * are filtered out inside the DB function, so this is safe to call
 * unconditionally for every viewer of a photographer profile.
 */
export async function recordProfileView(photographerId: string): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("record_profile_view", {
      p_photographer_id: photographerId,
    });
  } catch {
    // Never let analytics collection break the page.
  }
}
