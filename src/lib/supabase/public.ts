import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isDemo } from "@/lib/demo/flag";
import { createMockClient } from "@/lib/demo/mock-client";
import type { Database } from "./database.types";

/**
 * Cookieless anon Supabase client for PUBLIC, viewer-independent reads (e.g. a
 * photographer's public profile, the landing "latest shoots" list). Because it
 * carries no session it is safe to use inside `unstable_cache` — the result can
 * never contain per-user data. RLS still applies via the anon role, which has
 * SELECT on the public tables (profiles, photographer_details, portfolio_images,
 * reviews, photographer_ratings, photographer_unavailable, open shoots).
 */
export function createPublicClient() {
  if (isDemo())
    return createMockClient() as unknown as ReturnType<typeof createClient<Database>>;
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
