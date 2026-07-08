import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { shootImage } from "@/lib/shoot-image";
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

  // Active-offer counts in a single query (was one shoot_bid_count RPC per row).
  // Mirrors shoot_bid_count: count only pending + accepted bids. RLS lets the
  // owning client read bids on their own shoots.
  const shootIds = shootList.map((s) => s.id);
  const { data: bidRows } = shootIds.length
    ? await supabase
        .from("bids")
        .select("shoot_id, status")
        .in("shoot_id", shootIds)
        .in("status", ["pending", "accepted"])
    : { data: [] as { shoot_id: string; status: string }[] };
  const bidCountBy = new Map<string, number>();
  for (const b of bidRows ?? []) {
    bidCountBy.set(b.shoot_id, (bidCountBy.get(b.shoot_id) ?? 0) + 1);
  }

  const createCtaLink = (
    <Link
      href="/shoots/new"
      data-testid="my-shoots-create"
      className="press inline-flex items-center gap-1.5 bg-ink px-5 py-2.5 text-paper label"
    >
      <span className="text-base leading-none">+</span>
      {tMyShoots("createCta")}
    </Link>
  );

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-4">
        <PageHeading title={tMyShoots("title")} count={shootList.length} />
        <div className="shrink-0 pb-1">{createCtaLink}</div>
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
          {shootList.map((shoot) => (
            <div
              key={shoot.id}
              className="flex flex-col gap-2 py-5 transition-colors hover:bg-surface sm:gap-1"
            >
              <Link
                href={`/shoots/${shoot.id}`}
                data-testid={`my-shoot-${shoot.id}`}
                className="press flex items-center gap-4"
              >
                <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden bg-chip sm:block">
                  <Image
                    src={shootImage(shoot.type, shoot.id, 240, 160)}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover grayscale"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="label uppercase text-mute">
                    {tShoot(`types.${shoot.type}`)} · {shoot.location_city},{" "}
                    {shoot.canton} · {formatSwissDate(shoot.shoot_date)}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                    {shoot.title}
                  </h2>
                  <p className="mt-0.5 tabular text-sm text-mute">
                    {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)}{" "}
                    ·{" "}
                    {tShoot("bidsCount", {
                      count: bidCountBy.get(shoot.id) ?? 0,
                    })}
                  </p>
                </div>
                <ShootStatusBadge status={shoot.status} />
              </Link>
              {shoot.status === "open" &&
              (bidCountBy.get(shoot.id) ?? 0) === 0 ? (
                <Link
                  href={`/photographers?canton=${shoot.canton}&type=${shoot.type}`}
                  data-testid={`find-photographers-cta-${shoot.id}`}
                  className="press inline-block self-start pl-0 text-[13px] text-accent hover:opacity-70 sm:pl-[112px]"
                >
                  {tShoot("findPhotographersCta")}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
