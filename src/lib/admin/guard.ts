import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The is_admin gate for every /admin route.
 *
 * Next renders a route's page segment independently of its layout, and skips
 * layouts the client claims to have mounted, so a check in (admin)/layout.tsx
 * cannot keep page data away from a non-admin. Every admin page and admin data
 * helper therefore calls this (directly or via adminPageClient) BEFORE reading
 * anything. Server actions keep their own requireAdmin() in actions/admin.ts.
 */
export const requireAdminProfile = cache(async () => {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  if (!profile) return redirect({ href: "/login", locale });
  if (!profile.is_admin) return redirect({ href: "/home", locale });
  return profile;
});

/**
 * The service-role client for admin pages, handed out only after the caller is
 * proven an admin. Null when the service-role key is not configured.
 */
export async function adminPageClient() {
  await requireAdminProfile();
  return createAdminClient();
}
