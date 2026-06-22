import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, avatar_url, city, canton, locale, is_admin, is_suspended, suspension_reason"
    )
    .eq("id", user.id)
    .single();
  return data;
});

/**
 * Returns true if the current user is a photographer who has not yet
 * completed onboarding (i.e. has no photographer_details row).
 * Used by home and other app pages to redirect to /onboarding rather than
 * doing it in the (app) root layout (which would cause a redirect loop since
 * the onboarding page itself lives under (app)).
 */
export const photographerNeedsOnboarding = cache(async () => {
  const profile = await getProfile();
  if (!profile || profile.role !== "photographer") return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("photographer_details")
    .select("profile_id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  return !data;
});
