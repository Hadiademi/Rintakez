import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { getProfile, photographerNeedsOnboarding } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ShootCard } from "@/components/shoot-card";
import { ShootStatusBadge } from "@/components/shoot-status-badge";
import { HeroCta } from "@/components/hero-cta";
import { SectionLabel } from "@/components/section-label";
import { formatCHFRange, formatSwissDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Step = { n: number; title: string; desc: string };

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
  const name = profile.display_name ?? "";

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

    const steps: Step[] = [
      { n: 1, title: t("stepClient1Title"), desc: t("stepClient1Desc") },
      { n: 2, title: t("stepClient2Title"), desc: t("stepClient2Desc") },
      { n: 3, title: t("stepClient3Title"), desc: t("stepClient3Desc") },
    ];

    return (
      <div className="space-y-12">
        <header className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            {t("greeting", { name })}
          </h1>
          <p className="mt-3 text-mute">{t("subtitleClient")}</p>
        </header>

        {all.length > 0 && (
          <StatStrip>
            <Stat value={all.length} label={t("statShoots")} />
            <Stat value={open} label={t("statOpen")} />
            <Stat value={assigned} label={t("statAssigned")} />
          </StatStrip>
        )}

        <HeroCta
          label={t("ctaClientLabel")}
          title={t("ctaClientTitle")}
          desc={t("ctaClientDesc")}
          href="/shoots/new"
        />

        {recent.length > 0 ? (
          <section className="space-y-5">
            <SectionLabel
              index="02"
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
      .limit(6),
    supabase.from("bids").select("id,status").eq("photographer_id", profile.id),
  ]);

  const bids = myBids ?? [];
  const pending = bids.filter((b) => b.status === "pending").length;
  const accepted = bids.filter((b) => b.status === "accepted").length;
  const open = openShoots ?? [];

  const steps: Step[] = [
    { n: 1, title: t("stepPhotog1Title"), desc: t("stepPhotog1Desc") },
    { n: 2, title: t("stepPhotog2Title"), desc: t("stepPhotog2Desc") },
    { n: 3, title: t("stepPhotog3Title"), desc: t("stepPhotog3Desc") },
  ];

  return (
    <div className="space-y-12">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          {t("greeting", { name })}
        </h1>
        <p className="mt-3 text-mute">{t("subtitlePhotographer")}</p>
      </header>

      {bids.length > 0 && (
        <StatStrip>
          <Stat value={bids.length} label={t("statBids")} />
          <Stat value={pending} label={t("statPending")} />
          <Stat value={accepted} label={t("statAssigned")} />
        </StatStrip>
      )}

      <HeroCta
        label={t("ctaPhotographerLabel")}
        title={t("ctaPhotographerTitle")}
        desc={t("ctaPhotographerDesc")}
        href="/shoots"
      />

      {bids.length === 0 && (
        <HowItWorks heading={t("howItWorks")} steps={steps} />
      )}

      <section className="space-y-5">
        <SectionLabel
          index="02"
          title={t("openShoots")}
          action={
            <Link href="/shoots" className="label text-mute hover:text-ink">
              {t("seeAll")}
            </Link>
          }
        />
        {open.length === 0 ? (
          <p className="text-mute">{t("none")}</p>
        ) : (
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {open.map((s) => (
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
