import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ShootCard, type ShootCardData } from "@/components/shoot-card";
import { createClient } from "@/lib/supabase/server";

// Live marketplace data; revisit caching strategy in Plan 5.
export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTranslations("landing");
  const supabase = await createClient();

  const { data: shoots } = await supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-medium tracking-tight">Rintakez</span>
        <LocaleSwitcher />
      </header>
      <div className="h-px bg-line" />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="max-w-2xl text-4xl font-medium tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-mute">{t("subtitle")}</p>
        <button className="press mt-8 bg-ink px-6 py-3 text-paper">
          {t("cta")}
        </button>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="label text-mute">{t("latestShoots")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(shoots ?? []).map((s) => (
            <ShootCard key={s.id} shoot={s as ShootCardData} />
          ))}
        </div>
      </section>
    </main>
  );
}
