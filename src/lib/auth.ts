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
  // The profiles SELECT grant is column-scoped to a safe public-identity
  // allowlist (20260709000000_profiles_column_privacy) — is_admin,
  // is_suspended, suspension_reason, notify_bids, notify_shoot_updates etc.
  // are not selectable via a plain table read, even for your own row.
  // current_profile() is a SECURITY DEFINER function that returns the
  // caller's own full row, bypassing that grant safely (scoped to
  // auth.uid()). It's declared `returns public.profiles` (not `setof`), so
  // PostgREST/postgrest-js already type `data` as a single row object (or
  // null) without chaining `.single()`/`.maybeSingle()` — confirmed both by
  // a live RPC call and by the generated Functions.current_profile type
  // (SetofOptions.isSetofReturn: false). Do NOT add `.single()` here: in the
  // installed postgrest-js version it collapses `data`'s inferred type to
  // `null`-only for this function shape (verified empirically).
  const { data } = await supabase.rpc("current_profile");
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
