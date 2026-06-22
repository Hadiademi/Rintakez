import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { getSessionUser } from "@/lib/auth";
import { formatCHF } from "@/lib/format";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { Stars } from "@/components/stars";
import { SaveButton } from "@/components/save-button";
import { ReportButton } from "@/components/report-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, role, city")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.role !== "photographer") {
    return { title: "Rintakez" };
  }

  const { display_name, city } = data;

  const locationLabel: Record<string, string> = {
    de: city ? ` in ${city}` : "",
    fr: city ? ` à ${city}` : "",
    en: city ? ` in ${city}` : "",
  };

  const roleLabel: Record<string, string> = {
    de: "Fotograf:in",
    fr: "Photographe",
    en: "Photographer",
  };

  const role = roleLabel[locale] ?? roleLabel.de;
  const location = locationLabel[locale] ?? locationLabel.de;

  return {
    title: display_name,
    description: `${display_name} — ${role}${location}`,
  };
}

export default async function PhotographerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;

  // All public, viewer-independent profile data is cached at the data layer
  // (revalidate 5 min + per-photographer tag) so repeat views don't re-query the
  // DB. Per-viewer state (save button) is fetched separately below and stays
  // dynamic, so a cached page is never served with another user's state.
  const data = await unstable_cache(
    async () => {
      const supabase = createPublicClient();

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, role, city, canton, bio, avatar_url")
        .eq("id", id)
        .maybeSingle();

      if (!profile || profile.role !== "photographer") return null;

      const { data: details } = await supabase
        .from("photographer_details")
        .select(
          "specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url, verification_status, disciplines"
        )
        .eq("profile_id", id)
        .maybeSingle();

      const { data: rawImages } = await supabase
        .from("portfolio_images")
        .select("id, storage_path")
        .eq("photographer_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      const portfolioImages = (rawImages ?? []).map((img) => ({
        id: img.id,
        url: supabase.storage
          .from("portfolio")
          .getPublicUrl(img.storage_path).data.publicUrl,
      }));

      let avatarUrl: string | null = null;
      if (profile.avatar_url) {
        const raw = profile.avatar_url;
        avatarUrl =
          raw.startsWith("http://") || raw.startsWith("https://")
            ? raw
            : supabase.storage.from("avatars").getPublicUrl(raw).data.publicUrl;
      }

      const { data: rating } = await supabase
        .from("photographer_ratings")
        .select("avg_rating, review_count")
        .eq("photographer_id", id)
        .maybeSingle();

      const { data: reviewRows } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at")
        .eq("photographer_id", id)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: unavailableRows } = await supabase
        .from("photographer_unavailable")
        .select("date")
        .eq("photographer_id", id)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true });

      return {
        profile,
        details,
        portfolioImages,
        avatarUrl,
        rating,
        reviewRows: reviewRows ?? [],
        unavailableDates: (unavailableRows ?? []).map((r) => r.date),
      };
    },
    ["photographer-public", id],
    { revalidate: 300, tags: [`photographer:${id}`] }
  )();

  if (!data) notFound();

  const {
    profile,
    details,
    portfolioImages,
    avatarUrl,
    rating,
    reviewRows,
    unavailableDates,
  } = data;

  // Per-viewer state (dynamic): can a logged-in client save this photographer?
  const viewer = await getSessionUser();
  let isSaved = false;
  if (viewer && viewer.id !== id) {
    const supabase = await createClient();
    const { data: fav } = await supabase
      .from("favorites")
      .select("photographer_id")
      .eq("user_id", viewer.id)
      .eq("photographer_id", id)
      .maybeSingle();
    isSaved = !!fav;
  }

  const t = await getTranslations("profile");
  const tShoot = await getTranslations("shoot");
  const tReview = await getTranslations("review");

  // Initials for avatar placeholder
  const initials = profile.display_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const specialties = details?.specialties ?? [];
  const coverageCantons = details?.coverage_cantons ?? [];

  // Structured data — helps photographer profiles surface in search.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.display_name,
    jobTitle: "Photographer",
    ...(profile.city
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: profile.city,
            addressRegion: profile.canton ?? undefined,
            addressCountry: "CH",
          },
        }
      : {}),
    ...(rating && rating.review_count
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.avg_rating,
            reviewCount: rating.review_count,
          },
        }
      : {}),
  };

  const coverUrl = portfolioImages[0]?.url ?? null;

  return (
    <main className="bg-paper min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Cover band — first portfolio image, else a monogram band */}
      <div className="relative h-48 w-full overflow-hidden border-b border-line bg-chip sm:h-60">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover grayscale"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-chip to-surface">
            <span className="select-none text-[110px] font-semibold leading-none tracking-tight text-mute-2/40">
              {initials}
            </span>
          </div>
        )}
        <Link
          href="/"
          className="absolute left-5 top-5 inline-flex items-center gap-1 rounded-full border border-line bg-paper/85 px-3 py-1.5 text-[13px] text-ink backdrop-blur transition-opacity hover:opacity-80"
        >
          ← Rintakez
        </Link>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-12">
          {/* Identity card — overlaps the cover, sticky on desktop */}
          <aside className="-mt-16 space-y-6 lg:sticky lg:top-8 lg:self-start">
            <div className="space-y-4">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={profile.display_name}
                  className="h-28 w-28 rounded-full border-4 border-paper object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-paper bg-chip shadow-sm">
                  <span className="text-[30px] font-medium text-mute">
                    {initials}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
                  {profile.display_name}
                  {details?.verification_status === "verified" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[12px] font-normal text-accent">
                      ✓ {t("verified")}
                    </span>
                  )}
                </h1>
                {(profile.city || profile.canton) && (
                  <p className="text-[14px] text-mute">
                    {[profile.city, profile.canton].filter(Boolean).join(", ")}
                  </p>
                )}
                {rating && rating.review_count ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Stars value={rating.avg_rating ?? 0} />
                    <span className="tabular text-[13px] text-mute">
                      {rating.avg_rating?.toFixed(1)} ·{" "}
                      {tReview("count", { count: rating.review_count })}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {details?.hourly_rate_chf != null && (
              <div className="border-t border-line pt-4">
                <p className="label text-mute">{t("hourlyRate")}</p>
                <p className="tabular mt-1 text-2xl font-semibold text-ink">
                  {t("hourlyFrom", {
                    amount: formatCHF(details.hourly_rate_chf),
                  })}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {viewer && viewer.id !== profile.id && (
                <SaveButton photographerId={profile.id} initialSaved={isSaved} />
              )}
              <Link
                href="/shoots/new"
                className="press bg-ink px-5 py-3 text-center text-sm font-medium text-paper"
              >
                {t("postShootCta")}
              </Link>
              <div className="pt-1">
                <ReportButton targetType="profile" targetId={profile.id} />
              </div>
            </div>
          </aside>

          {/* Main column */}
          <div className="mt-10 min-w-0 space-y-10 lg:mt-2">

        {unavailableDates.length > 0 && (
          <div className="space-y-2">
            <p className="label text-mute">{t("availUnavailable")}</p>
            <div className="flex flex-wrap gap-2">
              {unavailableDates.map((d) => (
                <span
                  key={d}
                  className="tabular rounded-full bg-chip px-3 py-1 text-[13px] text-mute line-through"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <p className="text-[15px] text-mute whitespace-pre-line leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Details section */}
        {(specialties.length > 0 ||
          coverageCantons.length > 0 ||
          details?.hourly_rate_chf != null ||
          details?.website_url ||
          details?.instagram_url) && (
          <div className="space-y-6 border-t border-line pt-8">
            {/* Disciplines (photo / video) */}
            {(details?.disciplines ?? []).length > 0 && (
              <div className="space-y-2">
                <p className="label text-mute">{t("disciplines")}</p>
                <div className="flex flex-wrap gap-2">
                  {(details?.disciplines ?? []).map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-line px-3 py-1 text-[13px] text-ink"
                    >
                      {tShoot(`disciplines.${d}`)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Specialties */}
            {specialties.length > 0 && (
              <div className="space-y-2">
                <p className="label text-mute">{t("specialties")}</p>
                <div className="flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1 rounded-full bg-chip text-ink text-[13px]"
                    >
                      {tShoot(`types.${s}`)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage */}
            {coverageCantons.length > 0 && (
              <div className="space-y-2">
                <p className="label text-mute">{t("coverage")}</p>
                <div className="flex flex-wrap gap-2">
                  {coverageCantons.map((canton) => (
                    <span
                      key={canton}
                      className="px-3 py-1 rounded-full bg-chip text-ink text-[13px]"
                    >
                      {canton}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(details?.website_url || details?.instagram_url) && (
              <div className="flex flex-wrap gap-4">
                {details.website_url && (
                  <a
                    href={details.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-accent underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    {t("website")}
                  </a>
                )}
                {details.instagram_url && (
                  <a
                    href={details.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] text-accent underline underline-offset-2 hover:opacity-70 transition-opacity"
                  >
                    {t("instagram")}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Portfolio */}
        <div className="space-y-4 border-t border-line pt-8">
          <p className="label text-mute">{t("portfolio")}</p>
          {portfolioImages.length > 0 ? (
            <PortfolioGrid images={portfolioImages} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center border border-dashed border-line bg-chip/40 text-mute-2"
                  aria-hidden
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
              ))}
              <p className="col-span-full text-[14px] text-mute">
                {t("noPortfolio")}
              </p>
            </div>
          )}
        </div>

          {/* Reviews */}
          <div className="space-y-5 border-t border-line pt-8">
            <p className="label text-mute">{tReview("reviews")}</p>
            {reviewRows && reviewRows.length > 0 ? (
              <ul className="space-y-5">
                {reviewRows.map((r) => (
                  <li key={r.id} className="space-y-1.5">
                    <Stars value={r.rating} />
                    {r.comment ? (
                      <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
                        {r.comment}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-mute">{tReview("noReviews")}</p>
            )}
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}
