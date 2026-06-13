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
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { shootImage } from "@/lib/shoot-image";

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
      <div className="order-2 lg:order-1">
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
          className="press group order-1 block lg:order-2"
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-paper px-5 py-6">
      <div className="text-4xl font-semibold tabular tracking-tight text-ink">
        {String(value).padStart(2, "0")}
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
          featuredLabel={t("ctaClientLabel")}
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
                  className="press flex items-center justify-between gap-4 py-5"
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

        <RecommendedPhotographers />
      </div>
    );
  }

  // Photographer
  const [{ data: openShoots }, { data: myBids }] = await Promise.all([
    supabase
      .from("shoots")
      .select(
        "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(7),
    supabase.from("bids").select("id,status").eq("photographer_id", profile.id),
  ]);

  const bids = myBids ?? [];
  const pending = bids.filter((b) => b.status === "pending").length;
  const accepted = bids.filter((b) => b.status === "accepted").length;
  const open = openShoots ?? [];
  const featured = open[0];
  const rest = open.slice(1, 7);

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

      {bids.length > 0 && (
        <StatStrip>
          <Stat value={bids.length} label={t("statBids")} />
          <Stat value={pending} label={t("statPending")} />
          <Stat value={accepted} label={t("statAssigned")} />
        </StatStrip>
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
