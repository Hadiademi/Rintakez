"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Fires the Plausible `signup` event once for OAuth signups. The OAuth callback
 * (src/app/auth/callback/route.ts) appends `?signup=1` to the post-login
 * redirect for brand-new accounts; email signups already fire it client-side in
 * register-form.tsx. This mirrors that for the OAuth path.
 *
 * Reads the flag from window.location (so no useSearchParams / Suspense
 * boundary is needed), fires exactly once, then strips the param via
 * replaceState so a refresh can't double-count. Mounted app-wide in AppNav.
 */
export function SignupTracker() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("signup") !== "1") return;
    track("signup");
    url.searchParams.delete("signup");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  return null;
}
