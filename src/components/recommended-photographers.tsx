import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { PhotographerCard } from "@/components/photographer-card";
import type { Database } from "@/lib/supabase/database.types";
import type { Plan } from "@/lib/billing/plans";

type Canton = Database["public"]["Enums"]["canton"];

// Soft tiebreakers layered on top of rating — never enough to outrank a
// meaningfully better-rated photographer, just nudges locals/specialists up
// among otherwise-similar candidates.
const CANTON_BOOST = 0.5;
const SPECIALTY_BOOST = 0.15;

/**
 * "Recommended photographers" — top photographers by average rating (rated ones
 * first), shown on the dashboard as image-led cards. When the viewer's canton
 * (and optionally their recent shoot types) is known, candidates serving that
 * canton or matching those types get a small boost so locality/relevance
 * breaks ties among similarly-rated photographers — rating stays the base
 * signal, and no photographer is excluded for lacking a locality match.
 * Renders nothing when there are no photographers.
 */
export async function RecommendedPhotographers({
  viewerCanton = null,
  viewerTypes = [],
}: {
  viewerCanton?: Canton | null;
  viewerTypes?: string[];
} = {}) {
  const supabase = await createClient();

  const [{ data: photogs }, { data: ratings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, city, canton, avatar_url, created_at")
      .eq("role", "photographer")
      .eq("is_suspended", false)
      // Deterministic candidate set (newest first) so ranking isn't applied to
      // an arbitrary slice; the best by rating then surface to the top 3.
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("photographer_ratings")
      .select("photographer_id, avg_rating, review_count"),
  ]);

  if (!photogs || photogs.length === 0) return null;
  type PhotogRow = (typeof photogs)[number];

  const ratingBy = new Map(
    (ratings ?? []).map((r) => [
      r.photographer_id,
      { avg: r.avg_rating ?? 0, count: r.review_count ?? 0 },
    ])
  );

  // Locality/specialty data is only needed to break ties, so fetch it for the
  // whole candidate set up front (cheap: 60 rows, indexed on profile_id).
  // effective_tier is fetched for the same candidate set (not just the
  // eventual top 3) so the Premium spotlight boost below can actually move a
  // Premium candidate INTO the top 3, not just re-order within it.
  const candidateIds = photogs.map((p) => p.id);
  const [{ data: coverageRows }, { data: tierRows }] = await Promise.all([
    viewerCanton
      ? supabase
          .from("photographer_details")
          .select("profile_id, coverage_cantons, specialties")
          .in("profile_id", candidateIds)
      : Promise.resolve({ data: null }),
    supabase
      .from("photographer_effective_tier")
      .select("profile_id, effective_tier")
      .in("profile_id", candidateIds),
  ]);

  const coverageBy = new Map(
    (coverageRows ?? []).map((r) => [
      r.profile_id,
      {
        cantons: r.coverage_cantons ?? [],
        specialties: r.specialties ?? [],
      },
    ])
  );
  const tierBy = new Map(
    (tierRows ?? []).map((r) => [r.profile_id, r.effective_tier as Plan])
  );

  function localityBoost(p: PhotogRow) {
    if (!viewerCanton) return 0;
    const coverage = coverageBy.get(p.id);
    const cantonMatch =
      p.canton === viewerCanton ||
      (coverage?.cantons ?? []).includes(viewerCanton);
    const specialtyMatch =
      viewerTypes.length > 0 &&
      (coverage?.specialties ?? []).some((s) => viewerTypes.includes(s));
    return (
      (cantonMatch ? CANTON_BOOST : 0) + (specialtyMatch ? SPECIALTY_BOOST : 0)
    );
  }

  const ranked = photogs
    .map((p) => {
      const rating = ratingBy.get(p.id) ?? { avg: 0, count: 0 };
      const effective_tier: Plan = tierBy.get(p.id) ?? "free";
      return { ...p, rating, effective_tier, score: rating.avg + localityBoost(p) };
    })
    .sort(
      (a, b) =>
        // Premium spotlight: Premium candidates lead the top-3, ahead of the
        // score/rating tiebreakers below — still the best-matched
        // photographers, Premium just gets priority. Standard/basic/free are
        // otherwise ranked purely by score here (placement is a
        // directory/SEO perk, not a dashboard-recommendation one).
        Number(b.effective_tier === "premium") -
          Number(a.effective_tier === "premium") ||
        b.score - a.score ||
        b.rating.count - a.rating.count ||
        a.display_name.localeCompare(b.display_name)
    )
    .slice(0, 3);
  const topIds = ranked.map((p) => p.id);

  const [{ data: details }, { data: coverRows }] = await Promise.all([
    supabase
      .from("photographer_details")
      .select(
        "profile_id, disciplines, specialties, hourly_rate_chf, verification_status, cover_path"
      )
      .in("profile_id", topIds),
    supabase
      .from("portfolio_images")
      .select("photographer_id, storage_path")
      .in("photographer_id", topIds)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const detailsBy = new Map((details ?? []).map((d) => [d.profile_id, d]));
  const firstPortfolioBy = new Map<string, string>();
  for (const r of coverRows ?? []) {
    if (!firstPortfolioBy.has(r.photographer_id))
      firstPortfolioBy.set(r.photographer_id, r.storage_path);
  }

  const t = await getTranslations("review");
  const tDir = await getTranslations("directory");
  const tShoot = await getTranslations("shoot");

  function publicUrl(bucket: "avatars" | "portfolio", path: string | null) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {t("recommended")}
      </h2>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((p) => {
          const d = detailsBy.get(p.id);
          const coverPath = d?.cover_path ?? firstPortfolioBy.get(p.id) ?? null;
          return (
            <PhotographerCard
              key={p.id}
              verifiedLabel={tDir("verified")}
              newLabel={t("newBadge")}
              topPartnerLabel={tDir("topPartner")}
              data={{
                id: p.id,
                name: p.display_name,
                city: p.city,
                canton: p.canton,
                avatarUrl: publicUrl("avatars", p.avatar_url),
                coverUrl: publicUrl("portfolio", coverPath),
                verified: d?.verification_status === "verified",
                isTopPartner: p.effective_tier === "premium",
                disciplineLabels: (d?.disciplines ?? []).map((x) =>
                  tShoot(`disciplines.${x}`)
                ),
                specialtyLabels: (d?.specialties ?? []).map((x) =>
                  tShoot(`types.${x}`)
                ),
                rating: p.rating,
                hourlyRate: d?.hourly_rate_chf ?? null,
                memberSinceYear: new Date(p.created_at).getFullYear(),
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
