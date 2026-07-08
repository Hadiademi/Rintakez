import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getProfile, photographerNeedsOnboarding } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShootCard } from "@/components/shoot-card";
import { ShootStatusBadge } from "@/components/shoot-status-badge";
import { SectionLabel } from "@/components/section-label";
import { RecommendedPhotographers } from "@/components/recommended-photographers";
import { ProfileChecklist } from "@/components/profile-checklist";
import { scoreProfileCompleteness } from "@/lib/profile-completeness";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { shootImage } from "@/lib/shoot-image";
import { acceptanceRate } from "@/lib/bid-stats";

export const dynamic = "force-dynamic";

type Step = { n: number; title: string; desc: string };

type FeaturedData = {
  id: string;
  title: string;
  type: string;
  location_city: string;
  canton: string;
  budget_min_chf: number;
  budget_max_chf: number;
};

/** Split editorial hero: copy + CTAs on the left, a large featured cover on the right. */
function Hero({
  label,
  greeting,
  subtitle,
  primary,
  secondary,
  featured,
  featuredLabel,
  featuredMeta,
}: {
  label: string;
  greeting: string;
  subtitle: string;
  primary: { href: string; text: string };
  secondary: { href: string; text: string };
  featured?: FeaturedData;
  featuredLabel: string;
  featuredMeta?: string;
}) {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="order-1 lg:order-1">
        <p className="label text-mute">{label}</p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.02] tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {greeting}
        </h1>
        <p className="mt-5 max-w-md text-mute leading-relaxed">{subtitle}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href={primary.href}
            className="press inline-flex items-center gap-2 bg-ink px-6 py-3.5 text-sm font-medium text-paper"
          >
            {primary.text}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link
            href={secondary.href}
            className="press inline-flex items-center border border-line px-6 py-3.5 text-sm font-medium text-ink hover:border-ink"
          >
            {secondary.text}
          </Link>
        </div>
      </div>

      {featured && (
        <Link
          href={`/shoots/${featured.id}`}
          className="press group order-2 block lg:order-2"
        >
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-chip">
            <Image
              src={shootImage(featured.type, featured.id, 900, 1100)}
              alt={featured.title}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="object-cover grayscale transition-[filter,transform] duration-700 group-hover:grayscale-0 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6 pt-16">
              <span className="inline-block bg-paper/90 px-2 py-1 label text-ink">
                {featuredLabel}
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {featured.title}
              </h2>
              {featuredMeta && (
                <p className="mt-1 tabular label text-white/80">{featuredMeta}</p>
              )}
            </div>
          </div>
        </Link>
      )}
    </section>
  );
}

function HowItWorks({ heading, steps }: { heading: string; steps: Step[] }) {
  return (
    <section className="space-y-6">
      <SectionLabel index="01" title={heading} />
      <div className="grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="bg-paper p-6">
            <span className="text-3xl font-semibold tabular text-mute-2">
              {String(s.n).padStart(2, "0")}
            </span>
            <h3 className="mt-4 font-semibold tracking-tight text-ink">
              {s.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  formatted,
}: {
  value?: number;
  label: string;
  formatted?: string;
}) {
  return (
    <div className="bg-paper px-5 py-6">
      <div className="text-4xl font-semibold tabular tracking-tight text-ink">
        {formatted ?? String(value ?? 0).padStart(2, "0")}
      </div>
      <div className="label mt-2 text-mute">{label}</div>
    </div>
  );
}

function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden border border-line bg-line">
      {children}
    </div>
  );
}

export default async function HomePage() {
  const [profile, locale, needsOnboarding] = await Promise.all([
    getProfile(),
    getLocale(),
    photographerNeedsOnboarding(),
  ]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (needsOnboarding) {
    redirect({ href: "/onboarding", locale });
    return null;
  }

  const t = await getTranslations("home");
  const tShoot = await getTranslations("shoot");
  const supabase = await createClient();
  const fullName = profile.display_name ?? "";
  const firstName = fullName.split(/\s+/)[0] || fullName;

  if (profile.role === "client") {
    const { data: shoots } = await supabase
      .from("shoots")
      .select(
        "id,title,type,location_city,canton,shoot_date,budget_min_chf,budget_max_chf,status"
      )
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false });

    const all = shoots ?? [];
    const open = all.filter((s) => s.status === "open").length;
    const assigned = all.filter((s) => s.status === "assigned").length;
    const recent = all.slice(0, 5);
    const featured = all.find((s) => s.status !== "cancelled") ?? all[0];
    // Recent shoot types (newest few, already loaded above) — a cheap signal
    // to nudge "Recommended photographers" toward the client's specialties.
    const recentTypes = [...new Set(all.slice(0, 5).map((s) => s.type))];

    const steps: Step[] = [
      { n: 1, title: t("stepClient1Title"), desc: t("stepClient1Desc") },
      { n: 2, title: t("stepClient2Title"), desc: t("stepClient2Desc") },
      { n: 3, title: t("stepClient3Title"), desc: t("stepClient3Desc") },
    ];

    return (
      <div className="space-y-16">
        <Hero
          label={t("ctaClientLabel")}
          greeting={t("greeting", { name: firstName })}
          subtitle={t("subtitleClient")}
          primary={{ href: "/shoots/new", text: t("ctaClientTitle") }}
          secondary={{ href: "/my-shoots", text: t("yourShoots") }}
          featured={featured}
          featuredLabel={
            featured ? tShoot(`status.${featured.status}`) : t("ctaClientLabel")
          }
          featuredMeta={
            featured
              ? formatCHFRange(featured.budget_min_chf, featured.budget_max_chf)
              : undefined
          }
        />

        {all.length > 0 && (
          <StatStrip>
            <Stat value={all.length} label={t("statShoots")} />
            <Stat value={open} label={t("statOpen")} />
            <Stat value={assigned} label={t("statAssigned")} />
          </StatStrip>
        )}

        {recent.length > 0 ? (
          <section className="space-y-5">
            <SectionLabel
              index="01"
              title={t("yourShoots")}
              action={
                <Link
                  href="/my-shoots"
                  className="label text-mute hover:text-ink"
                >
                  {t("seeAll")}
                </Link>
              }
            />
            <div className="divide-y divide-line border-y border-line">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  href={`/shoots/${s.id}`}
                  className="press flex items-center justify-between gap-4 py-5 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0">
                    <p className="label uppercase text-mute">
                      {s.location_city}, {s.canton} ·{" "}
                      {formatSwissDate(s.shoot_date)}
                    </p>
                    <p className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                      {s.title}
                    </p>
                    <p className="mt-0.5 tabular text-sm text-mute">
                      {formatCHFRange(s.budget_min_chf, s.budget_max_chf)}
                    </p>
                  </div>
                  <ShootStatusBadge status={s.status} />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <HowItWorks heading={t("howItWorks")} steps={steps} />
        )}

        <RecommendedPhotographers
          viewerCanton={profile.canton}
          viewerTypes={recentTypes}
        />
      </div>
    );
  }

  // Photographer
  const OPEN_SHOOTS_COLUMNS =
    "id,title,type,discipline,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf";
  const OPEN_SHOOTS_LIMIT = 7;
  const MIN_PERSONALIZED_RESULTS = 3;

  const [
    { data: details },
    { data: myBids },
    { data: ownProfile },
    { count: portfolioCount },
    { data: effTierRow },
  ] = await Promise.all([
    supabase
      .from("photographer_details")
      .select(
        "coverage_cantons, disciplines, specialties, hourly_rate_chf, verification_status"
      )
      .eq("profile_id", profile.id)
      .maybeSingle(),
    supabase.from("bids").select("id,status").eq("photographer_id", profile.id),
    supabase.from("profiles").select("bio").eq("id", profile.id).single(),
    supabase
      .from("portfolio_images")
      .select("id", { count: "exact", head: true })
      .eq("photographer_id", profile.id),
    supabase
      .from("photographer_effective_tier")
      .select("effective_tier")
      .eq("profile_id", profile.id)
      .maybeSingle(),
  ]);

  const tier = effTierRow?.effective_tier ?? "free";

  const coverageCantons = details?.coverage_cantons ?? [];
  const disciplines = details?.disciplines ?? [];

  const completeness = scoreProfileCompleteness({
    hasAvatar: Boolean(profile.avatar_url),
    bioLength: ownProfile?.bio?.length ?? 0,
    portfolioCount: portfolioCount ?? 0,
    hasRate: (details?.hourly_rate_chf ?? 0) > 0,
    cantonsCount: coverageCantons.length,
    specialtiesCount: (details?.specialties ?? []).length,
    verificationStatus: details?.verification_status ?? "unverified",
  });

  let personalizedQuery = supabase
    .from("shoots")
    .select(OPEN_SHOOTS_COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(OPEN_SHOOTS_LIMIT);
  if (coverageCantons.length > 0) {
    personalizedQuery = personalizedQuery.in("canton", coverageCantons);
  }
  if (disciplines.length > 0) {
    personalizedQuery = personalizedQuery.in("discipline", disciplines);
  }
  const { data: personalizedShoots } = await personalizedQuery;

  const open = personalizedShoots ?? [];

  // Photographers with little/no coverage or brand-new accounts can get a
  // sparse (or empty) personalized result — top it up with the newest global
  // open shoots so the feed is never empty, de-duplicated by id.
  if (open.length < MIN_PERSONALIZED_RESULTS) {
    const { data: globalShoots } = await supabase
      .from("shoots")
      .select(OPEN_SHOOTS_COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(OPEN_SHOOTS_LIMIT);

    const seen = new Set(open.map((s) => s.id));
    for (const shoot of globalShoots ?? []) {
      if (open.length >= OPEN_SHOOTS_LIMIT) break;
      if (seen.has(shoot.id)) continue;
      seen.add(shoot.id);
      open.push(shoot);
    }
  }

  const bids = myBids ?? [];
  const pending = bids.filter((b) => b.status === "pending").length;
  const accepted = bids.filter((b) => b.status === "accepted").length;
  const featured = open[0];
  const rest = open.slice(1, 7);
  const rate = acceptanceRate(bids);

  // Only call the entitled RPCs for tiers that need them — free/basic never
  // fetch views30d or the premium benchmark.
  const showDashboard = tier === "standard" || tier === "premium";
  let views30d: number | null = null;
  let benchmark: number | null = null;
  if (showDashboard) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: viewsData } = await supabase.rpc("photographer_view_count", {
      p_photographer_id: profile.id,
      p_since: sinceStr,
    });
    views30d = viewsData ?? 0;
    if (tier === "premium") {
      const { data: benchmarkData } = await supabase.rpc(
        "platform_median_acceptance_rate"
      );
      benchmark = benchmarkData ?? null;
    }
  }

  const steps: Step[] = [
    { n: 1, title: t("stepPhotog1Title"), desc: t("stepPhotog1Desc") },
    { n: 2, title: t("stepPhotog2Title"), desc: t("stepPhotog2Desc") },
    { n: 3, title: t("stepPhotog3Title"), desc: t("stepPhotog3Desc") },
  ];

  return (
    <div className="space-y-16">
      <Hero
        label={`${t("ctaPhotographerLabel")}${profile.city ? ` · ${profile.city}` : ""}`}
        greeting={t("greeting", { name: firstName })}
        subtitle={t("subtitlePhotographer")}
        primary={{ href: "/shoots", text: t("ctaPhotographerTitle") }}
        secondary={{ href: "/my-bids", text: t("statBids") }}
        featured={featured}
        featuredLabel={t("ctaPhotographerLabel")}
        featuredMeta={
          featured
            ? formatCHFRange(featured.budget_min_chf, featured.budget_max_chf)
            : undefined
        }
      />

      <ProfileChecklist result={completeness} />

      {bids.length > 0 && (
        <StatStrip>
          <Stat value={bids.length} label={t("statBids")} />
          <Stat value={pending} label={t("statPending")} />
          <Stat value={accepted} label={t("statAssigned")} />
        </StatStrip>
      )}

      {showDashboard && (
        <StatStrip>
          <Stat value={views30d ?? 0} label={t("statViews30d")} />
          <Stat
            formatted={rate === null ? "—" : `${Math.round(rate * 100)} %`}
            label={t("statApplicationRate")}
          />
          {tier === "premium" ? (
            <Stat
              formatted={
                benchmark == null ? "—" : `${Math.round(Number(benchmark) * 100)} %`
              }
              label={t("statBenchmark")}
            />
          ) : (
            <Link href="/pricing" className="press block bg-paper px-5 py-6">
              <div className="text-4xl font-semibold tabular tracking-tight text-mute">
                —
              </div>
              <div className="label mt-2 text-mute">
                {t("statBenchmarkLocked")}
              </div>
            </Link>
          )}
        </StatStrip>
      )}

      {(tier === "free" || tier === "basic") && (
        <Link
          href="/pricing"
          className="press block border border-line px-4 py-3 text-sm text-mute hover:text-ink"
        >
          {t("dashboardUpsell")}
        </Link>
      )}

      {bids.length === 0 && (
        <HowItWorks heading={t("howItWorks")} steps={steps} />
      )}

      <section className="space-y-6">
        <SectionLabel
          index="02"
          title={t("openShoots")}
          action={
            <Link href="/shoots" className="label text-mute hover:text-ink">
              {t("seeAll")}
            </Link>
          }
        />
        {rest.length === 0 ? (
          <p className="text-mute">{t("none")}</p>
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s) => (
              <Link key={s.id} href={`/shoots/${s.id}`} className="press block">
                <ShootCard shoot={s} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
