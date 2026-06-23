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
import { Link } from "@/i18n/navigation";
import { unstable_cache } from "next/cache";

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
  };
}

export default async function Home() {
  const [t, tNav, tMarket, profile] = await Promise.all([
    getTranslations("landing"),
    getTranslations("nav"),
    getTranslations("marketplace"),
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

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-medium tracking-tight">Rintakez</span>
        <div className="flex items-center gap-4">
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
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>
      <div className="h-px bg-line" />

      <section className="mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
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

      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="flex items-center justify-between gap-4">
          <h2 className="label text-mute">{t("latestShoots")}</h2>
          <Link
            href="/shoots"
            className="label press text-mute hover:text-ink"
          >
            {tMarket("browseAll")} →
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(shoots ?? []).map((s) => (
            <Link key={s.id} href={`/shoots/${s.id}`} className="press block">
              <ShootCard shoot={s} />
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
