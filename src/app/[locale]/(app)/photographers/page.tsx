import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { formatCHF } from "@/lib/format";
import { Stars } from "@/components/stars";
import { PhotographerFilters } from "@/components/photographer-filters";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
      "profile_id, specialties, coverage_cantons, hourly_rate_chf, verification_status, disciplines"
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

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
        <p className="text-mute">{t("subtitle")}</p>
      </div>

      <PhotographerFilters />

      <p className="label text-mute">{t("count", { count: total })}</p>

      {total === 0 ? (
        <p className="text-mute">{t("empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((x) => {
            let avatarUrl: string | null = null;
            if (x.profile.avatar_url) {
              avatarUrl =
                x.profile.avatar_url.startsWith("http")
                  ? x.profile.avatar_url
                  : supabase.storage
                      .from("avatars")
                      .getPublicUrl(x.profile.avatar_url).data.publicUrl;
            }
            return (
              <Link
                key={x.profile_id}
                href={`/photographers/${x.profile_id}`}
                data-testid="photographer-card"
                className="press group flex flex-col gap-4 border border-line p-5 transition-colors hover:border-mute-2"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-line bg-chip">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-full w-full object-cover grayscale"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[13px] font-medium text-mute">
                        {initials(x.profile.display_name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium text-ink">
                      <span className="truncate">{x.profile.display_name}</span>
                      {x.verification_status === "verified" && (
                        <span
                          title={t("verified")}
                          aria-label={t("verified")}
                          className="shrink-0 text-accent"
                        >
                          ✓
                        </span>
                      )}
                    </p>
                    {(x.profile.city || x.profile.canton) && (
                      <p className="truncate text-[13px] text-mute">
                        {[x.profile.city, x.profile.canton]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {x.disciplines?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {x.disciplines.map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-mute"
                      >
                        {tShoot(`disciplines.${d}`)}
                      </span>
                    ))}
                  </div>
                )}

                {x.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {x.specialties.slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-chip px-2.5 py-0.5 text-[12px] text-ink"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between">
                  {x.rating.count > 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Stars value={x.rating.avg} size={12} />
                      <span className="tabular text-[12px] text-mute">
                        {x.rating.avg.toFixed(1)}
                      </span>
                    </span>
                  ) : (
                    <span />
                  )}
                  {x.hourly_rate_chf != null && (
                    <span className="tabular text-[13px] text-mute">
                      {formatCHF(x.hourly_rate_chf)}/h
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        params={{ type, canton, minRating, sort, saved }}
        basePath="/photographers"
      />
    </div>
  );
}
