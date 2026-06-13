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
  searchParams: Promise<{ canton?: string; type?: string; budgetMax?: string }>;
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

  const t = await getTranslations("browse");
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

  query = query.order("created_at", { ascending: false });

  const { data: shoots } = await query;
  const list = shoots ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeading title={t("title")} count={list.length} />

      {/* Filters */}
      <ShootFilters />

      {/* Grid / empty state */}
      {list.length === 0 ? (
        <p className="text-mute">{t("empty")}</p>
      ) : (
        <div
          data-testid="browse-list"
          className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
        >
          {list.map((s) => (
            <Link
              key={s.id}
              href={`/shoots/${s.id}`}
              className="press block"
            >
              <ShootCard shoot={s} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
