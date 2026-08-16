import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import {
  getDirectoryBaseList,
  applyDirectoryOverlay,
} from "@/lib/photographer-directory";
import { PhotographerFilters } from "@/components/photographer-filters";
import { PhotographerCard } from "@/components/photographer-card";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { buildAlternates } from "@/lib/seo";
import { PopularSearches } from "@/components/popular-searches";
import { getActiveCantonTypeCombos } from "@/lib/photographer-landing-combos";
import { TIER_RANK } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("photographersTitle"),
    description: t("photographersDescription"),
    alternates: buildAlternates(locale, "/photographers"),
  };
}

export default async function PhotographersDirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    type?: string;
    canton?: string;
    minRating?: string;
    sort?: string;
    saved?: string;
    verified?: string;
    discipline?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const {
    type,
    canton,
    minRating,
    sort,
    saved,
    verified,
    discipline,
    q,
    page: pageParam,
  } = await searchParams;
  const query = q?.trim().toLowerCase() ?? "";
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();
  const t = await getTranslations("directory");
  const tShoot = await getTranslations("shoot");
  const tReview = await getTranslations("review");

  // "Saved only" filter — restrict to the viewer's favorited photographers.
  let savedIds: Set<string> | null = null;
  if (saved) {
    const viewer = await getSessionUser();
    if (viewer) {
      const { data: favs } = await supabase
        .from("favorites")
        .select("photographer_id")
        .eq("user_id", viewer.id);
      savedIds = new Set((favs ?? []).map((f) => f.photographer_id));
    } else {
      savedIds = new Set();
    }
  }

  // Base dataset + per-request overlay both live in photographer-directory.ts,
  // shared verbatim with /api/directory/count (the mobile filter sheet's live
  // result count) so the promised count always matches what renders here.
  const baseList = await getDirectoryBaseList({
    type,
    canton,
    verified,
    discipline,
  });

  let list = applyDirectoryOverlay(baseList, {
    minRating: minRating ? Number(minRating) : 0,
    query,
    savedIds,
  });

  list = list.sort((a, b) => {
    if (sort === "price") {
      return (a.hourly_rate_chf ?? Infinity) - (b.hourly_rate_chf ?? Infinity);
    }
    if (sort === "newest") {
      return (
        new Date(b.profile.created_at).getTime() -
        new Date(a.profile.created_at).getTime()
      );
    }
    // Default: paid tiers (standard/premium) placed above free/basic — the
    // subscription placement perk — then top rated, with stable tiebreakers
    // so unrated (avg 0) photographers don't shuffle arbitrarily — more
    // reviews, then verified, then name. Only this default ranking is
    // affected; price/newest sorts return earlier above and respect the
    // viewer's explicit sort intent.
    return (
      TIER_RANK[b.effective_tier] - TIER_RANK[a.effective_tier] ||
      b.rating.avg - a.rating.avg ||
      b.rating.count - a.rating.count ||
      Number(b.verification_status === "verified") -
        Number(a.verification_status === "verified") ||
      a.profile.display_name.localeCompare(b.profile.display_name)
    );
  });

  // Ranking (rating filter + sort + "saved only") spans tables, so it is
  // computed in memory; pagination then slices the assembled list. The
  // directory dataset (photographers) is naturally small. If it grows large,
  // promote ranking into a denormalized/materialized view and paginate in SQL.
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pageItems = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Card cover = cover_path, else the photographer's first portfolio image
  // (one batched query for the visible page only — not N+1).
  const pageIds = pageItems.map((x) => x.profile_id);
  const { data: coverRows } = pageIds.length
    ? await supabase
        .from("portfolio_images")
        .select("photographer_id, storage_path")
        .in("photographer_id", pageIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] as { photographer_id: string; storage_path: string }[] };
  const firstPortfolioBy = new Map<string, string>();
  for (const r of coverRows ?? []) {
    if (!firstPortfolioBy.has(r.photographer_id))
      firstPortfolioBy.set(r.photographer_id, r.storage_path);
  }

  function publicUrl(bucket: "avatars" | "portfolio", path: string | null) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="label text-mute">{t("eyebrow")}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-mute">{t("subtitle")}</p>
        </div>
        <p className="label shrink-0 text-mute">{t("count", { count: total })}</p>
      </div>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-12">
        <PhotographerFilters />

        <div className="mt-6 space-y-8 lg:mt-0">
          {total === 0 ? (
            <EmptyState description={t("empty")} />
          ) : (
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {pageItems.map((x) => {
                const coverPath =
                  x.cover_path ?? firstPortfolioBy.get(x.profile_id) ?? null;
                return (
                  <PhotographerCard
                    key={x.profile_id}
                    verifiedLabel={t("verified")}
                    newLabel={tReview("newBadge")}
                    topPartnerLabel={t("topPartner")}
                    data={{
                      id: x.profile_id,
                      name: x.profile.display_name,
                      city: x.profile.city,
                      canton: x.profile.canton,
                      avatarUrl: publicUrl("avatars", x.profile.avatar_url),
                      coverUrl: publicUrl("portfolio", coverPath),
                      verified: x.verification_status === "verified",
                      isTopPartner: x.effective_tier === "premium",
                      disciplineLabels: (x.disciplines ?? []).map((d) =>
                        tShoot(`disciplines.${d}`)
                      ),
                      specialtyLabels: (x.specialties ?? []).map((s) =>
                        tShoot(`types.${s}`)
                      ),
                      rating: x.rating,
                      hourlyRate: x.hourly_rate_chf,
                      memberSinceYear: new Date(
                        x.profile.created_at
                      ).getFullYear(),
                    }}
                  />
                );
              })}
            </div>
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            params={{ type, canton, minRating, sort, saved, verified, discipline, q }}
            basePath="/photographers"
          />

          {/* Internal links into the canton x shoot-type landing pages, so
              crawlers (and visitors) can discover them from the directory —
              only on the unfiltered view, so it reads as a discovery aid
              rather than clutter once someone's already narrowed their
              search. */}
          {!type &&
          !canton &&
          !discipline &&
          !minRating &&
          !saved &&
          !verified &&
          !query ? (
            <PopularSearches
              combos={await getActiveCantonTypeCombos()}
              locale={locale}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
