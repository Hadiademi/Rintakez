import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Stars } from "@/components/stars";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * "Recommended photographers" — top photographers by average rating (rated
 * ones first), shown on the dashboard. Renders nothing when there are no
 * photographers. Ratings are real; unrated photographers show a "New" badge
 * rather than a fabricated score.
 */
export async function RecommendedPhotographers() {
  const supabase = await createClient();

  const [{ data: photogs }, { data: ratings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, city, canton, avatar_url")
      .eq("role", "photographer")
      .eq("is_suspended", false)
      .limit(24),
    supabase
      .from("photographer_ratings")
      .select("photographer_id, avg_rating, review_count"),
  ]);

  if (!photogs || photogs.length === 0) return null;

  const ratingBy = new Map(
    (ratings ?? []).map((r) => [
      r.photographer_id,
      { avg: r.avg_rating ?? 0, count: r.review_count ?? 0 },
    ])
  );

  const ranked = photogs
    .map((p) => ({ ...p, rating: ratingBy.get(p.id) ?? null }))
    .sort((a, b) => (b.rating?.avg ?? -1) - (a.rating?.avg ?? -1))
    .slice(0, 3);

  const t = await getTranslations("review");

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {t("recommended")}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((p) => {
          let avatarUrl: string | null = null;
          if (p.avatar_url) {
            avatarUrl =
              p.avatar_url.startsWith("http://") ||
              p.avatar_url.startsWith("https://")
                ? p.avatar_url
                : supabase.storage.from("avatars").getPublicUrl(p.avatar_url)
                    .data.publicUrl;
          }
          return (
            <Link
              key={p.id}
              href={`/photographers/${p.id}`}
              className="press group flex items-center gap-4 border border-line p-4 transition-colors hover:border-mute-2"
            >
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
                    {initials(p.display_name)}
                  </span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium text-ink">
                  {p.display_name}
                </span>
                {(p.city || p.canton) && (
                  <span className="truncate text-[13px] text-mute">
                    {[p.city, p.canton].filter(Boolean).join(", ")}
                  </span>
                )}
                {p.rating && p.rating.count > 0 ? (
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <Stars value={p.rating.avg} size={12} />
                    <span className="tabular text-[12px] text-mute">
                      {p.rating.avg.toFixed(1)}
                    </span>
                  </span>
                ) : (
                  <span className="label mt-0.5 text-mute-2">
                    {t("newBadge")}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
