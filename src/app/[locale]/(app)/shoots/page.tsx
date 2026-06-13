import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CANTONS, SHOOT_TYPES } from "@/lib/validation/photographer";
import { ShootCard } from "@/components/shoot-card";
import { ShootFilters } from "@/components/shoot-filters";
import { PageHeading } from "@/components/section-label";

export const dynamic = "force-dynamic";

export default async function BrowseShootsPage({
  searchParams,
}: {
  searchParams: Promise<{
    canton?: string;
    type?: string;
    budgetMax?: string;
    q?: string;
  }>;
}) {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  const sp = await searchParams;
  const canton = sp.canton;
  const type = sp.type;
  const budgetMax = sp.budgetMax;
  const q = sp.q?.trim();

  const t = await getTranslations("browse");
  const tNav = await getTranslations("nav");
  const supabase = await createClient();

  let query = supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
    )
    .eq("status", "open");

  if (canton && (CANTONS as readonly string[]).includes(canton)) {
    query = query.eq("canton", canton as (typeof CANTONS)[number]);
  }

  if (type && (SHOOT_TYPES as readonly string[]).includes(type)) {
    query = query.eq("type", type as (typeof SHOOT_TYPES)[number]);
  }

  const budgetMaxNum = budgetMax ? Number(budgetMax) : NaN;
  if (!isNaN(budgetMaxNum) && budgetMaxNum > 0) {
    query = query.lte("budget_min_chf", budgetMaxNum);
  }

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  query = query.order("created_at", { ascending: false });

  const { data: shoots } = await query;
  const list = shoots ?? [];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <PageHeading title={t("title")} count={list.length} />
        {profile.role === "client" && (
          <Link
            href="/shoots/new"
            className="press mt-2 hidden shrink-0 items-center gap-1.5 bg-ink px-5 py-3 text-sm font-medium text-paper sm:inline-flex"
          >
            <span className="text-base leading-none">+</span>
            {tNav("create")}
          </Link>
        )}
      </div>

      {/* Sidebar + grid */}
      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-14">
        <aside className="mb-8 lg:mb-0">
          <ShootFilters />
        </aside>

        <div>
          {list.length === 0 ? (
            <p className="text-mute">{t("empty")}</p>
          ) : (
            <div
              data-testid="browse-list"
              className="grid gap-x-6 gap-y-10 sm:grid-cols-2"
            >
              {list.map((s) => (
                <Link key={s.id} href={`/shoots/${s.id}`} className="press block">
                  <ShootCard shoot={s} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
