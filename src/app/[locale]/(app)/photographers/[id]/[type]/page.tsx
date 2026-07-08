import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { CANTONS, SHOOT_TYPES } from "@/lib/validation/photographer";
import { cantonName } from "@/lib/canton-names";
import { PhotographerCard } from "@/components/photographer-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buildAlternates } from "@/lib/seo";
import { TIER_RANK, type Plan } from "@/lib/billing/plans";

// NOTE ON THE FOLDER NAME: this route lives at `photographers/[id]/[type]`,
// reusing the `id` segment name from the sibling `photographers/[id]/page.tsx`
// (photographer profile) on purpose. Next.js's router resolves the first
// dynamic segment after `photographers/` as a single tree node, so every
// route at that position — regardless of what follows it — must declare the
// same param name, or the dev/build fails with "You cannot use different
// slug names for the same dynamic path". Here the value is actually a
// canton code, not a photographer id; it's renamed to `canton` immediately
// below the params destructure so the rest of this file reads naturally.

export const dynamic = "force-dynamic";

const SNAPSHOT_LIMIT = 12;

type Canton = (typeof CANTONS)[number];
type ShootType = (typeof SHOOT_TYPES)[number];

function isCanton(value: string): value is Canton {
  return (CANTONS as readonly string[]).includes(value);
}

function isShootType(value: string): value is ShootType {
  return (SHOOT_TYPES as readonly string[]).includes(value);
}

/**
 * Public, viewer-independent snapshot of photographers matching a canton ×
 * shoot-type combo. Cached briefly (matches the profile page's pattern) so
 * repeated crawler/visitor hits for the same combo don't re-query on every
 * request; tagged per-combo so it's easy to invalidate later if needed.
 */
async function getLandingData(canton: Canton, type: ShootType) {
  return unstable_cache(
    async () => {
      const supabase = createPublicClient();

      const { data: details } = await supabase
        .from("photographer_details")
        .select(
          "profile_id, specialties, coverage_cantons, hourly_rate_chf, verification_status, disciplines, cover_path"
        )
        .contains("specialties", [type])
        .contains("coverage_cantons", [canton]);

      const rows = details ?? [];
      const ids = rows.map((d) => d.profile_id);

      const [{ data: profiles }, { data: ratings }, { data: tiers }] =
        await Promise.all([
          ids.length
            ? supabase
                .from("profiles")
                .select("id, display_name, city, canton, avatar_url, is_suspended, created_at")
                .in("id", ids)
            : Promise.resolve({ data: [] as never[] }),
          ids.length
            ? supabase
                .from("photographer_ratings")
                .select("photographer_id, avg_rating, review_count")
                .in("photographer_id", ids)
            : Promise.resolve({ data: [] as never[] }),
          ids.length
            ? supabase
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

      let list = rows
        .map((d) => {
          const profile = profileBy.get(d.profile_id);
          const rating = ratingBy.get(d.profile_id) ?? { avg: 0, count: 0 };
          const effective_tier = tierBy.get(d.profile_id) ?? "free";
          return profile ? { ...d, profile, rating, effective_tier } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .filter((x) => !x.profile.is_suspended);

      // Paid tiers (standard/premium) placed above free/basic — the
      // subscription placement perk — then the same ranking as the directory
      // default: top rated, then most reviewed, then verified, then name —
      // so the snapshot mirrors what a visitor would see landing on the full
      // directory with these filters. This is the only ranking on this page
      // (no explicit sort param), so the tier term is unconditional.
      list = list.sort((a, b) => {
        return (
          TIER_RANK[b.effective_tier] - TIER_RANK[a.effective_tier] ||
          b.rating.avg - a.rating.avg ||
          b.rating.count - a.rating.count ||
          Number(b.verification_status === "verified") -
            Number(a.verification_status === "verified") ||
          a.profile.display_name.localeCompare(b.profile.display_name)
        );
      });

      const total = list.length;
      const pageItems = list.slice(0, SNAPSHOT_LIMIT);

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

      const items = pageItems.map((x) => {
        const coverPath = x.cover_path ?? firstPortfolioBy.get(x.profile_id) ?? null;
        return {
          id: x.profile_id,
          name: x.profile.display_name,
          city: x.profile.city as string | null,
          canton: x.profile.canton as string | null,
          avatarUrl: publicUrl("avatars", x.profile.avatar_url),
          coverUrl: publicUrl("portfolio", coverPath),
          verified: x.verification_status === "verified",
          isTopPartner: x.effective_tier === "premium",
          disciplines: x.disciplines ?? [],
          specialties: x.specialties ?? [],
          rating: x.rating,
          hourlyRate: x.hourly_rate_chf as number | null,
          memberSinceYear: new Date(x.profile.created_at).getFullYear(),
        };
      });

      return { total, items };
    },
    ["photographers-landing", canton, type],
    { revalidate: 300, tags: [`photographers-landing:${canton}:${type}`] }
  )();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string; type: string }>;
}): Promise<Metadata> {
  const { locale, id: canton, type } = await params;

  if (!isCanton(canton) || !isShootType(type)) {
    return { title: "Rintakez" };
  }

  const t = await getTranslations({ locale, namespace: "meta" });
  const tShoot = await getTranslations({ locale, namespace: "shoot" });
  const cName = cantonName(canton, locale);
  const typeLabel = tShoot(`types.${type}`);

  const { total } = await getLandingData(canton, type);

  return {
    title: t("landingTitle", { type: typeLabel, canton: cName }),
    description: t("landingDescription", { type: typeLabel, canton: cName }),
    alternates: buildAlternates(locale, `/photographers/${canton}/${type}`),
    // Thin-content guard: a combo with zero matching photographers has
    // nothing unique to say beyond the generic template, so keep it out of
    // the index (still followable, and still fully rendered with a helpful
    // empty state + links) until it has real listings.
    robots: total === 0 ? { index: false, follow: true } : undefined,
  };
}

export default async function CantonShootTypeLandingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string; type: string }>;
}) {
  const { locale, id: canton, type } = await params;

  if (!isCanton(canton) || !isShootType(type)) notFound();

  const [t, tShoot, tDir] = await Promise.all([
    getTranslations("landingSeo"),
    getTranslations("shoot"),
    getTranslations("directory"),
  ]);
  const tReview = await getTranslations("review");

  const cName = cantonName(canton, locale);
  const typeLabel = tShoot(`types.${type}`);

  const { total, items } = await getLandingData(canton, type);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: t("h1." + type, { canton: cName }),
    about: typeLabel,
    ...(items.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            itemListElement: items.map((item, idx) => ({
              "@type": "ListItem",
              position: idx + 1,
              url: `/${locale}/photographers/${item.id}`,
              name: item.name,
            })),
          },
        }
      : {}),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          {t(`h1.${type}`, { canton: cName })}
        </h1>
        <p className="max-w-2xl text-mute">{t(`intro.${type}`, { canton: cName })}</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="label text-mute">
          {t("snapshotHeading", { type: typeLabel, canton: cName })}
        </p>
        <Link
          href={{ pathname: "/photographers", query: { canton, type } }}
          className="label shrink-0 text-accent hover:opacity-70 transition-opacity"
        >
          {t("viewAllCta", { type: typeLabel, canton: cName })} →
        </Link>
      </div>

      {total === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription", { type: typeLabel, canton: cName })}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/photographers"
                className="press border border-line px-4 py-2 text-[14px] text-ink hover:border-ink"
              >
                {t("emptyBrowseAll")}
              </Link>
              <Link
                href="/register"
                className="press bg-ink px-4 py-2 text-[14px] font-medium text-paper"
              >
                {t("emptyJoin")}
              </Link>
            </div>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x) => (
            <PhotographerCard
              key={x.id}
              verifiedLabel={tDir("verified")}
              newLabel={tReview("newBadge")}
              topPartnerLabel={tDir("topPartner")}
              data={{
                id: x.id,
                name: x.name,
                city: x.city,
                canton: x.canton,
                avatarUrl: x.avatarUrl,
                coverUrl: x.coverUrl,
                verified: x.verified,
                isTopPartner: x.isTopPartner,
                disciplineLabels: x.disciplines.map((d) => tShoot(`disciplines.${d}`)),
                specialtyLabels: x.specialties.map((s) => tShoot(`types.${s}`)),
                rating: x.rating,
                hourlyRate: x.hourlyRate,
                memberSinceYear: x.memberSinceYear,
              }}
            />
          ))}
        </div>
      )}

      <div className="border-t border-line pt-6 text-center">
        <Link
          href={{ pathname: "/photographers", query: { canton, type } }}
          className="press inline-block border border-line px-5 py-3 text-[14px] text-ink hover:border-ink"
        >
          {t("viewAllCta", { type: typeLabel, canton: cName })}
        </Link>
      </div>
    </div>
  );
}
