import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCHF } from "@/lib/format";
import { PortfolioGrid } from "@/components/portfolio-grid";
import { Stars } from "@/components/stars";
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
  const supabase = await createClient();

  // Fetch profile — public via RLS
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, city, canton, bio, avatar_url")
    .eq("id", id)
    .maybeSingle();

  if (!profile || profile.role !== "photographer") notFound();

  // Fetch photographer details
  const { data: details } = await supabase
    .from("photographer_details")
    .select(
      "specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url"
    )
    .eq("profile_id", id)
    .maybeSingle();

  // Fetch portfolio images ordered by sort_order, then created_at
  const { data: rawImages } = await supabase
    .from("portfolio_images")
    .select("id, storage_path")
    .eq("photographer_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Build portfolio image URLs
  const portfolioImages = (rawImages ?? []).map((img) => ({
    id: img.id,
    url: supabase.storage
      .from("portfolio")
      .getPublicUrl(img.storage_path).data.publicUrl,
  }));

  // Build avatar URL
  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const raw = profile.avatar_url;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      avatarUrl = raw;
    } else {
      avatarUrl = supabase.storage
        .from("avatars")
        .getPublicUrl(raw).data.publicUrl;
    }
  }

  // Ratings & reviews (public).
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

  return (
    <main className="bg-paper min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] text-mute hover:text-ink transition-colors"
        >
          ← Rintakez
        </Link>

        {/* Header */}
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={profile.display_name}
                className="w-16 h-16 rounded-full object-cover border border-line"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-chip border border-line flex items-center justify-center">
                <span className="text-[18px] font-medium text-mute">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Name & location */}
          <div className="flex flex-col gap-1 pt-1">
            <h1 className="text-2xl font-medium tracking-tight text-ink">
              {profile.display_name}
            </h1>
            {(profile.city || profile.canton) && (
              <p className="text-[14px] text-mute">
                {[profile.city, profile.canton].filter(Boolean).join(", ")}
              </p>
            )}
            {rating && rating.review_count ? (
              <div className="mt-1 flex items-center gap-2">
                <Stars value={rating.avg_rating ?? 0} />
                <span className="tabular text-[13px] text-mute">
                  {rating.avg_rating?.toFixed(1)} ·{" "}
                  {tReview("count", { count: rating.review_count })}
                </span>
              </div>
            ) : null}
          </div>
        </div>

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

            {/* Hourly rate */}
            {details?.hourly_rate_chf != null && (
              <div className="space-y-1">
                <p className="label text-mute">{t("hourlyRate")}</p>
                <p className="text-[15px] text-ink tabular">
                  {t("hourlyFrom", { amount: formatCHF(details.hourly_rate_chf) })}
                </p>
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
            <p className="text-[14px] text-mute">{t("noPortfolio")}</p>
          )}
        </div>

        {/* Reviews */}
        {reviewRows && reviewRows.length > 0 && (
          <div className="space-y-5 border-t border-line pt-8">
            <p className="label text-mute">{tReview("reviews")}</p>
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
          </div>
        )}

        <div className="border-t border-line pt-6">
          <ReportButton targetType="profile" targetId={profile.id} />
        </div>
      </div>
    </main>
  );
}
