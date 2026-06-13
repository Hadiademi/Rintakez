import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShootCard } from "@/components/shoot-card";
import { SiteFooter } from "@/components/site-footer";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Link } from "@/i18n/navigation";

// Live marketplace data; revisit caching strategy in Plan 5.
export const dynamic = "force-dynamic";

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
  const [t, tNav, profile] = await Promise.all([
    getTranslations("landing"),
    getTranslations("nav"),
    getProfile(),
  ]);

  const supabase = await createClient();

  const { data: shoots } = await supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(6);

  // Determine CTA link target based on auth state and role
  const ctaHref =
    !profile
      ? "/register"
      : profile.role === "client"
        ? "/shoots/new"
        : "/shoots";

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
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

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="max-w-2xl text-4xl font-medium tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-mute">{t("subtitle")}</p>
        <Link
          href={ctaHref}
          className="press mt-8 inline-block bg-ink px-6 py-3 text-paper"
        >
          {t("cta")}
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="label text-mute">{t("latestShoots")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(shoots ?? []).map((s) => (
            <ShootCard key={s.id} shoot={s} />
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
