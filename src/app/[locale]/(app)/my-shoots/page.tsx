import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { ShootStatusBadge } from "@/components/shoot-status-badge";

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

  // Fetch bid counts in parallel (n+1 is acceptable for this list)
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
      className="press inline-block bg-ink text-paper px-4 py-2 label"
    >
      {tMyShoots("createCta")}
    </Link>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-medium tracking-tight">
          {tMyShoots("title")}
        </h1>
        {createCtaLink}
      </div>

      {/* Empty state */}
      {shootList.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-mute">{tMyShoots("empty")}</p>
          {createCtaLink}
        </div>
      ) : (
        /* Shoot list */
        <div
          data-testid="my-shoots-list"
          className="grid gap-4 sm:grid-cols-2"
        >
          {shootList.map((shoot, i) => (
            <Link
              key={shoot.id}
              href={`/shoots/${shoot.id}`}
              data-testid={`my-shoot-${shoot.id}`}
              className="block border border-line bg-surface p-5 hover:bg-paper transition-colors"
            >
              {/* Type + Status row */}
              <div className="flex items-center justify-between">
                <span className="label text-mute">
                  {tShoot(`types.${shoot.type}`)}
                </span>
                <ShootStatusBadge status={shoot.status} />
              </div>

              {/* Title */}
              <h2 className="mt-2 text-lg font-medium tracking-tight text-ink">
                {shoot.title}
              </h2>

              {/* Details row */}
              <dl className="mt-3 space-y-1 text-sm text-mute">
                <div className="flex justify-between">
                  <dt>{tShoot("location")}</dt>
                  <dd className="text-ink">
                    {shoot.location_city}, {shoot.canton}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>{tShoot("date")}</dt>
                  <dd className="tabular text-ink">
                    {formatSwissDate(shoot.shoot_date)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>{tShoot("budget")}</dt>
                  <dd className="tabular text-ink">
                    {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 tabular text-sm text-mute">
                {tShoot("bidsCount", { count: bidCounts[i] })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
