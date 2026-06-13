import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { ShootStatusBadge } from "@/components/shoot-status-badge";
import { PageHeading } from "@/components/section-label";

export const dynamic = "force-dynamic";

export default async function MyShootsPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (profile.role !== "client") {
    redirect({ href: "/home", locale });
    return null;
  }

  const tMyShoots = await getTranslations("myShoots");
  const tShoot = await getTranslations("shoot");
  const supabase = await createClient();

  const { data: shoots } = await supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,budget_min_chf,budget_max_chf,status"
    )
    .eq("client_id", profile.id)
    .order("created_at", { ascending: false });

  const shootList = shoots ?? [];

  const bidCounts = await Promise.all(
    shootList.map(async (shoot) => {
      const { data, error } = await supabase.rpc("shoot_bid_count", {
        p_shoot_id: shoot.id,
      });
      return error || data === null ? 0 : (data as number);
    })
  );

  const createCtaLink = (
    <Link
      href="/shoots/new"
      className="press inline-block bg-ink text-paper px-5 py-2.5 label"
    >
      {tMyShoots("createCta")}
    </Link>
  );

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <PageHeading title={tMyShoots("title")} count={shootList.length} />
        <div className="hidden shrink-0 pb-1 sm:block">{createCtaLink}</div>
      </div>

      {shootList.length === 0 ? (
        <div className="flex flex-col items-center gap-5 border border-line bg-surface py-20 text-center">
          <p className="text-mute">{tMyShoots("empty")}</p>
          {createCtaLink}
        </div>
      ) : (
        <div
          data-testid="my-shoots-list"
          className="divide-y divide-line border-y border-line"
        >
          {shootList.map((shoot, i) => (
            <Link
              key={shoot.id}
              href={`/shoots/${shoot.id}`}
              data-testid={`my-shoot-${shoot.id}`}
              className="press flex items-center justify-between gap-4 py-5"
            >
              <div className="min-w-0">
                <p className="label uppercase text-mute">
                  {tShoot(`types.${shoot.type}`)} · {shoot.location_city},{" "}
                  {shoot.canton} · {formatSwissDate(shoot.shoot_date)}
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                  {shoot.title}
                </h2>
                <p className="mt-0.5 tabular text-sm text-mute">
                  {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)} ·{" "}
                  {tShoot("bidsCount", { count: bidCounts[i] })}
                </p>
              </div>
              <ShootStatusBadge status={shoot.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
