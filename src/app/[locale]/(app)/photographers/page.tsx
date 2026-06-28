import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { PhotographerFilters } from "@/components/photographer-filters";
import { PhotographerCard } from "@/components/photographer-card";
import { Pagination } from "@/components/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { photographerAvatar } from "@/lib/shoot-image";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export default async function PhotographersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    canton?: string;
    minRating?: string;
    sort?: string;
    saved?: string;
    verified?: string;
    discipline?: string;
    page?: string;
  }>;
}) {
  const {
    type,
    canton,
    minRating,
    sort,
    saved,
    verified,
    discipline,
    page: pageParam,
  } = await searchParams;
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

  // Filter on the photographer_details (array columns), then enrich.
  let detailsQuery = supabase
    .from("photographer_details")
    .select(
      "profile_id, specialties, coverage_cantons, hourly_rate_chf, verification_status, disciplines, cover_path"
    );
  if (type) detailsQuery = detailsQuery.contains("specialties", [type]);
  if (canton) detailsQuery = detailsQuery.contains("coverage_cantons", [canton]);
  if (verified) detailsQuery = detailsQuery.eq("verification_status", "verified");
  if (discipline === "photo" || discipline === "video")
    detailsQuery = detailsQuery.contains("disciplines", [discipline]);
  const { data: details } = await detailsQuery;

  const ids = (details ?? []).map((d) => d.profile_id);

  const [{ data: profiles }, { data: ratings }] = await Promise.all([
    ids.length
      ? supabase
          .from("profiles")
          .select("id, display_name, city, canton, avatar_url, is_suspended")
          .in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase
          .from("photographer_ratings")
          .select("photographer_id, avg_rating, review_count")
          .in("photographer_id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const profileBy = new Map((profiles ?? []).map((p) => [p.id, p]));
  const ratingBy = new Map(
    (ratings ?? []).map((r) => [
      r.photographer_id,
      { avg: r.avg_rating ?? 0, count: r.review_count ?? 0 },
    ])
  );

  const minR = minRating ? Number(minRating) : 0;

  let list = (details ?? [])
    .map((d) => {
      const profile = profileBy.get(d.profile_id);
      const rating = ratingBy.get(d.profile_id) ?? { avg: 0, count: 0 };
      return profile ? { ...d, profile, rating } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((x) => !x.profile.is_suspended)
    .filter((x) => x.rating.avg >= minR)
    .filter((x) => !savedIds || savedIds.has(x.profile_id));

  list = list.sort((a, b) => {
    if (sort === "price") {
      return (a.hourly_rate_chf ?? Infinity) - (b.hourly_rate_chf ?? Infinity);
    }
    return b.rating.avg - a.rating.avg;
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
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
        <p className="text-mute">{t("subtitle")}</p>
      </div>

      <PhotographerFilters />

      <p className="label text-mute">{t("count", { count: total })}</p>

      {total === 0 ? (
        <EmptyState description={t("empty")} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((x) => {
            const coverPath =
              x.cover_path ?? firstPortfolioBy.get(x.profile_id) ?? null;
            return (
              <PhotographerCard
                key={x.profile_id}
                verifiedLabel={t("verified")}
                newLabel={tReview("newBadge")}
                data={{
                  id: x.profile_id,
                  name: x.profile.display_name,
                  city: x.profile.city,
                  canton: x.profile.canton,
                  avatarUrl: publicUrl("avatars", x.profile.avatar_url),
                  coverUrl:
                    publicUrl("portfolio", coverPath) ??
                    photographerAvatar(x.profile_id, 600, 450),
                  verified: x.verification_status === "verified",
                  disciplineLabels: (x.disciplines ?? []).map((d) =>
                    tShoot(`disciplines.${d}`)
                  ),
                  specialtyLabels: (x.specialties ?? []).map((s) =>
                    tShoot(`types.${s}`)
                  ),
                  rating: x.rating,
                  hourlyRate: x.hourly_rate_chf,
                }}
              />
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        params={{ type, canton, minRating, sort, saved, verified, discipline }}
        basePath="/photographers"
      />
    </div>
  );
}
