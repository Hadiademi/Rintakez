import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getProfile, photographerNeedsOnboarding } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShootCard } from "@/components/shoot-card";

export const dynamic = "force-dynamic";

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
  const tNav = await getTranslations("nav");
  const supabase = await createClient();

  if (profile.role === "client") {
    // Fetch the client's own shoots
    const { data: shoots } = await supabase
      .from("shoots")
      .select(
        "id,title,type,location_city,canton,shoot_date,budget_min_chf,budget_max_chf,status"
      )
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);

    return (
      <div className="space-y-10">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-medium tracking-tight">
            {t("greeting", { name: profile.display_name ?? "" })}
          </h1>
        </div>

        {/* CTA card */}
        <div className="border border-line bg-surface p-6">
          <p className="text-mute">{t("clientCta")}</p>
          <Link
            href="/shoots/new"
            className="press mt-4 inline-block bg-ink px-5 py-2.5 text-paper label"
          >
            {tNav("createShoot")}
          </Link>
        </div>

        {/* Recent shoots */}
        <div>
          <h2 className="label text-mute mb-4">{t("yourShoots")}</h2>
          {!shoots || shoots.length === 0 ? (
            <p className="text-mute">{t("none")}</p>
          ) : (
            <div className="space-y-3">
              {shoots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border border-line bg-surface px-5 py-4"
                >
                  <span className="font-medium text-ink">{s.title}</span>
                  <span className="label text-mute capitalize">{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Photographer: fetch open shoots
  const { data: openShoots } = await supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-medium tracking-tight">
          {t("greeting", { name: profile.display_name ?? "" })}
        </h1>
      </div>

      {/* CTA card */}
      <div className="border border-line bg-surface p-6">
        <p className="text-mute">{t("photographerCta")}</p>
        <Link
          href="/shoots"
          className="press mt-4 inline-block bg-ink px-5 py-2.5 text-paper label"
        >
          {tNav("browseShoots")}
        </Link>
      </div>

      {/* Open shoots preview */}
      <div>
        <h2 className="label text-mute mb-4">{t("openShoots")}</h2>
        {!openShoots || openShoots.length === 0 ? (
          <p className="text-mute">{t("none")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {openShoots.map((s) => (
              <ShootCard key={s.id} shoot={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
