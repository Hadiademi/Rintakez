import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { CANTONS, SHOOT_TYPES } from "@/lib/validation/photographer";

type Canton = (typeof CANTONS)[number];
type ShootType = (typeof SHOOT_TYPES)[number];

export type CantonTypeCombo = { canton: Canton; type: ShootType; count: number };

/**
 * Every canton x shoot-type combo that has >=1 matching, non-suspended
 * photographer, with a match count — the shared source of truth for both
 * `sitemap.ts` (which combo pages are worth indexing) and the directory
 * page's "popular searches" block (which combos are worth surfacing as
 * internal links). Computed in memory from one query: the photographer
 * roster is small (same assumption the directory page's own ranking makes),
 * so a 26-canton x 7-type cross tabulation is cheap.
 *
 * Cached for 5 minutes (matches the photographer profile page's cache
 * window) since this only needs to be "fresh enough", not real-time.
 */
export const getActiveCantonTypeCombos = unstable_cache(
  async (): Promise<CantonTypeCombo[]> => {
    const supabase = createPublicClient();

    const { data: details } = await supabase
      .from("photographer_details")
      .select("profile_id, specialties, coverage_cantons");

    const ids = [...new Set((details ?? []).map((d) => d.profile_id))];
    const { data: activeProfiles } = ids.length
      ? await supabase
          .from("profiles")
          .select("id")
          .in("id", ids)
          .eq("is_suspended", false)
      : { data: [] as { id: string }[] };
    const activeIds = new Set((activeProfiles ?? []).map((p) => p.id));

    const counts = new Map<string, number>();
    for (const row of details ?? []) {
      if (!activeIds.has(row.profile_id)) continue;
      for (const canton of row.coverage_cantons ?? []) {
        for (const type of row.specialties ?? []) {
          const key = `${canton}/${type}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }

    return [...counts.entries()].map(([key, count]) => {
      const [canton, type] = key.split("/") as [Canton, ShootType];
      return { canton, type, count };
    });
  },
  ["photographers-landing-combos"],
  { revalidate: 300, tags: ["photographers-landing-combos"] }
);
