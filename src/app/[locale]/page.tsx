import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShootCard } from "@/components/shoot-card";
import { SiteFooter } from "@/components/site-footer";
import { createPublicClient } from "@/lib/supabase/public";
import { getProfile } from "@/lib/auth";
import { shootImage } from "@/lib/shoot-image";
import { Link, getPathname } from "@/i18n/navigation";
import { unstable_cache } from "next/cache";
import { buildAlternates } from "@/lib/seo";
import { SkipToContent } from "@/components/skip-to-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// The page stays dynamic for per-viewer nav (getProfile reads cookies), but the
// public "latest open shoots" list is cached at the data layer so the DB is hit
// at most once per minute globally instead of on every visit.
const getLatestOpenShoots = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("shoots")
      .select(
        "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(6);
    return data ?? [];
  },
  ["landing-latest-shoots"],
  { revalidate: 60, tags: ["shoots:open"] }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: { absolute: t("title") },
    description: t("subtitle"),
    alternates: buildAlternates(locale, "/"),
  };
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, tNav, tMarket, tHome, profile] = await Promise.all([
    getTranslations("landing"),
    getTranslations("nav"),
    getTranslations("marketplace"),
    getTranslations("home"),
    getProfile(),
  ]);

  const shoots = await getLatestOpenShoots();

  // Determine CTA link target based on auth state and role
  const ctaHref =
    !profile
      ? "/register"
      : profile.role === "client"
        ? "/shoots/new"
        : "/shoots";

  const featured = shoots[0] ?? null;

  // Structured data — Organization identity + a WebSite SearchAction pointing
  // search engines at the photographers directory's own `q` filter, so a
  // sitelinks searchbox can query Rintakez directly.
  const photographersSearchUrl = `${SITE_URL}${getPathname({
    locale,
    href: "/photographers",
  })}?q={search_term_string}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Rintakez",
        url: SITE_URL,
      },
      {
        "@type": "WebSite",
        name: "Rintakez",
        url: SITE_URL,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: photographersSearchUrl,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col">
      <SkipToContent />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-base font-medium tracking-tight sm:text-lg"
        >
          Rintakez
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/pricing" className="text-sm hover:underline">
            {tNav("pricing")}
          </Link>
          {profile ? (
            <>
              <Link href="/home" className="text-sm hover:underline">
                {tNav("home")}
              </Link>
              <span className="text-sm text-mute">{profile.display_name}</span>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm hover:underline">
                {tNav("login")}
              </Link>
              <Link
                href="/register"
                className="press bg-ink px-3 py-1.5 text-sm text-paper"
              >
                {tNav("register")}
              </Link>
            </>
          )}
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <LocaleSwitcher />
        </div>
      </header>
      <div className="h-px bg-line" />

      <section id="main" className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-md text-lg text-mute">{t("subtitle")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={ctaHref}
                className="press inline-block bg-ink px-6 py-3 text-paper"
              >
                {t("cta")}
              </Link>
              <Link
                href="/photographers"
                className="press text-sm text-mute underline underline-offset-4 hover:text-ink"
              >
                {tNav("photographers")} →
              </Link>
            </div>
          </div>

          {/* Featured editorial visual (desktop) — fills the frame, gives the
              hero presence instead of empty space. */}
          {featured ? (
            <Link
              href={`/shoots/${featured.id}`}
              className="press group relative hidden aspect-[4/5] overflow-hidden bg-chip lg:block"
            >
              <Image
                src={shootImage(featured.type, featured.id, 900, 1125)}
                alt={featured.title}
                fill
                sizes="(min-width: 1024px) 40vw, 0px"
                className="object-cover grayscale transition-[filter,transform] duration-500 group-hover:scale-[1.02] group-hover:grayscale-0"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <span className="label text-paper/80">{t("latestShoots")}</span>
                <p className="mt-1 text-lg font-semibold text-paper">
                  {featured.title}
                </p>
              </div>
            </Link>
          ) : (
            <div className="hidden aspect-[4/5] items-center justify-center bg-gradient-to-br from-chip to-surface lg:flex">
              <span className="text-[120px] font-semibold leading-none text-mute-2/30">
                R
              </span>
            </div>
          )}
        </div>
      </section>

      {/* How it works — three steps, stacks on mobile */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2 className="label text-mute">{tHome("howItWorks")}</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-2">
              <span className="label tabular text-mute-2">
                {String(n).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-ink">
                {tHome(`stepClient${n}Title`)}
              </h3>
              <p className="text-[14px] leading-relaxed text-mute">
                {tHome(`stepClient${n}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 sm:grid-cols-3">
          {(["trust1", "trust2", "trust3"] as const).map((k) => (
            <p key={k} className="text-[14px] leading-relaxed text-ink">
              {t(k)}
            </p>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-16 pb-20">
        <div className="flex items-center justify-between gap-4">
          <h2 className="label text-mute">{t("latestShoots")}</h2>
          <Link
            href="/shoots"
            className="label press text-mute hover:text-ink"
          >
            {tMarket("browseAll")} →
          </Link>
        </div>
        {shoots.length === 0 ? (
          <p className="mt-4 text-[15px] text-mute">{t("noShoots")}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shoots.map((s) => (
              <Link key={s.id} href={`/shoots/${s.id}`} className="press block">
                <ShootCard shoot={s} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
