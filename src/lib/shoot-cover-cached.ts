import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { getShootCoverUrls } from "@/lib/shoot-cover";

/**
 * Cover URLs for OPEN shoots, cached ~45 min (safely under the 1h signed-URL
 * expiry).
 *
 * Why: fresh signing on every render gave each request a brand-new token in
 * the query string, so neither the browser nor /_next/image could ever reuse
 * a cached image — every navigation re-downloaded and re-optimized every
 * cover, which is exactly what made page-to-page feel heavy. A URL that stays
 * stable for ~45 min restores caching all the way down, and skips the two
 * per-request DB round-trips on cached surfaces.
 *
 * Uses the anon client, so RLS yields exactly the subset that is public
 * anyway (open shoots). Non-open shoots (owner surfaces) simply get no entry
 * here — callers merge a per-request authenticated fallback for those.
 * Entries are keyed by the sorted id set; separate sets cache separately.
 */
export async function getPublicShootCoverUrlsCached(
  shootIds: string[]
): Promise<Map<string, string>> {
  if (shootIds.length === 0) return new Map();
  const key = [...shootIds].sort();
  const cached = unstable_cache(
    async (ids: string[]) => {
      const map = await getShootCoverUrls(createPublicClient(), ids);
      // Maps don't survive the cache's serialization — store plain entries.
      return [...map.entries()];
    },
    ["shoot-covers-public"],
    { revalidate: 2700 }
  );
  return new Map(await cached(key));
}
