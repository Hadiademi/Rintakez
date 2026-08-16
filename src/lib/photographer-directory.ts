import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Plan } from "@/lib/billing/plans";

/**
 * Shared directory dataset for the photographer directory.
 *
 * Extracted from the directory page so the result-count endpoint
 * (/api/directory/count — powers the mobile filter sheet's live "show N
 * results" button) runs the EXACT same query + overlay as the page itself:
 * one source of truth, and both share the same unstable_cache entries.
 */

export type DirectoryBaseFilters = {
  type?: string;
  canton?: string;
  verified?: string;
  discipline?: string;
};

export type DirectoryEntry = {
  profile_id: string;
  specialties: string[] | null;
  coverage_cantons: string[] | null;
  hourly_rate_chf: number | null;
  verification_status: string;
  disciplines: string[] | null;
  cover_path: string | null;
  profile: {
    id: string;
    display_name: string;
    city: string | null;
    canton: string | null;
    avatar_url: string | null;
    is_suspended: boolean;
    created_at: string;
  };
  rating: { avg: number; count: number };
  effective_tier: Plan;
};

/**
 * Viewer-independent base dataset (details + profiles + ratings + tiers,
 * filtered to type/canton/verified/discipline, suspended excluded). PUBLIC and
 * identical across users, so it's cached at the data layer (revalidate 120s +
 * the directory tag) via the cookieless public client. The cache key includes
 * every filter that shapes the base fetch so each combination caches
 * separately.
 */
export function getDirectoryBaseList({
  type,
  canton,
  verified,
  discipline,
}: DirectoryBaseFilters): Promise<DirectoryEntry[]> {
  return unstable_cache(
    async () => {
      const publicClient = createPublicClient();

      let detailsQuery = publicClient
        .from("photographer_details")
        .select(
          "profile_id, specialties, coverage_cantons, hourly_rate_chf, verification_status, disciplines, cover_path"
        );
      if (type) detailsQuery = detailsQuery.contains("specialties", [type]);
      if (canton)
        detailsQuery = detailsQuery.contains("coverage_cantons", [canton]);
      if (verified)
        detailsQuery = detailsQuery.eq("verification_status", "verified");
      if (discipline === "photo" || discipline === "video")
        detailsQuery = detailsQuery.contains("disciplines", [discipline]);
      const { data: details } = await detailsQuery;

      const ids = (details ?? []).map((d) => d.profile_id);

      const [{ data: profiles }, { data: ratings }, { data: tiers }] =
        await Promise.all([
          ids.length
            ? publicClient
                .from("profiles")
                .select(
                  "id, display_name, city, canton, avatar_url, is_suspended, created_at"
                )
                .in("id", ids)
            : Promise.resolve({ data: [] as never[] }),
          ids.length
            ? publicClient
                .from("photographer_ratings")
                .select("photographer_id, avg_rating, review_count")
                .in("photographer_id", ids)
            : Promise.resolve({ data: [] as never[] }),
          ids.length
            ? publicClient
                .from("photographer_effective_tier")
                .select("profile_id, effective_tier")
                .in("profile_id", ids)
            : Promise.resolve({ data: [] as never[] }),
        ]);

      const profileBy = new Map((profiles ?? []).map((p) => [p.id, p]));
      const ratingBy = new Map(
        (ratings ?? []).map((r) => [
          r.photographer_id,
          { avg: r.avg_rating ?? 0, count: r.review_count ?? 0 },
        ])
      );
      const tierBy = new Map(
        (tiers ?? []).map((t) => [t.profile_id, t.effective_tier as Plan])
      );

      return (details ?? [])
        .map((d) => {
          const profile = profileBy.get(d.profile_id);
          const rating = ratingBy.get(d.profile_id) ?? { avg: 0, count: 0 };
          const effective_tier = tierBy.get(d.profile_id) ?? "free";
          return profile ? { ...d, profile, rating, effective_tier } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .filter((x) => !x.profile.is_suspended);
    },
    [
      "photographers-directory",
      type ?? "",
      canton ?? "",
      verified ?? "",
      discipline ?? "",
    ],
    { revalidate: 120, tags: ["photographers-directory"] }
  )() as Promise<DirectoryEntry[]>;
}

/**
 * Per-request overlay on the cached base list: minRating, the viewer's
 * "saved only" restriction, and the name query. Used identically by the page
 * and the count endpoint so the sheet's promised count matches what renders.
 */
export function applyDirectoryOverlay(
  list: DirectoryEntry[],
  {
    minRating,
    query,
    savedIds,
  }: {
    minRating: number;
    query: string;
    /** null = no "saved only" filter active */
    savedIds: Set<string> | null;
  }
): DirectoryEntry[] {
  return list
    .filter((x) => x.rating.avg >= minRating)
    .filter((x) => !savedIds || savedIds.has(x.profile_id))
    .filter(
      (x) => !query || x.profile.display_name.toLowerCase().includes(query)
    );
}
