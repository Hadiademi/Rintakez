import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShootCard } from "@/components/shoot-card";
import { SiteFooter } from "@/components/site-footer";
import { createPublicClient } from "@/lib/supabase/public";
import { getProfile } from "@/lib/auth";
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

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
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

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h1 className="max-w-2xl text-4xl font-medium tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-mute">{t("subtitle")}</p>
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
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
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
