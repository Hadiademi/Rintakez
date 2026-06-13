import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { ShootStatusBadge } from "@/components/shoot-status-badge";
import { BidCard, type BidCardData } from "@/components/bid-card";
import { ContactReveal } from "@/components/contact-reveal";
import { CancelShootButton } from "@/components/cancel-shoot-button";
import { BidSheet } from "@/components/bid-sheet";
import { MyBidPanel } from "@/components/my-bid-panel";

export const dynamic = "force-dynamic";

export default async function ShootDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  const supabase = await createClient();
  const { data: shoot } = await supabase
    .from("shoots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!shoot) notFound();

  const tShoot = await getTranslations("shoot");
  const t = await getTranslations("shootDetail");

  const isOwner = shoot.client_id === profile.id;
  const location = `${shoot.location_city}${
    shoot.location_postcode ? ` ${shoot.location_postcode}` : ""
  }, ${shoot.canton}`;

  const detailsGrid = (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div>
        <dt className="label text-mute">{tShoot("type")}</dt>
        <dd className="mt-1 text-ink">{tShoot(`types.${shoot.type}`)}</dd>
      </div>
      <div>
        <dt className="label text-mute">{tShoot("location")}</dt>
        <dd className="mt-1 text-ink">{location}</dd>
      </div>
      <div>
        <dt className="label text-mute">{tShoot("date")}</dt>
        <dd className="mt-1 tabular text-ink">
          {formatSwissDate(shoot.shoot_date)}
        </dd>
      </div>
      <div>
        <dt className="label text-mute">{tShoot("duration")}</dt>
        <dd className="mt-1 tabular text-ink">
          {tShoot("hours", { count: shoot.duration_hours })}
        </dd>
      </div>
      <div>
        <dt className="label text-mute">{tShoot("budget")}</dt>
        <dd className="mt-1 tabular text-ink">
          {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)}
        </dd>
      </div>
    </dl>
  );

  const summary = (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-medium tracking-tight">{shoot.title}</h1>
        <ShootStatusBadge status={shoot.status} />
      </div>

      <section className="space-y-3">
        <h2 className="label text-mute">{t("details")}</h2>
        {detailsGrid}
      </section>

      <section className="space-y-2">
        <h2 className="label text-mute">{t("brief")}</h2>
        <p className="whitespace-pre-line text-ink">{shoot.brief}</p>
      </section>
    </div>
  );

  // ── Photographer view ─────────────────────────────────────────────
  // Photographers never own shoots. They may read only their OWN bid.
  if (!isOwner && profile.role === "photographer") {
    const { data: myBid } = await supabase
      .from("bids")
      .select("id,amount_chf,message,status")
      .eq("shoot_id", id)
      .eq("photographer_id", profile.id)
      .maybeSingle();

    const tBid = await getTranslations("bidSheet");

    return (
      <div className="space-y-10">
        {summary}
        {myBid ? (
          <MyBidPanel
            bid={myBid}
            canEdit={myBid.status === "pending" && shoot.status === "open"}
          />
        ) : shoot.status === "open" ? (
          <BidSheet
            shootId={id}
            budgetRange={formatCHFRange(
              shoot.budget_min_chf,
              shoot.budget_max_chf
            )}
          />
        ) : (
          <p className="text-mute">{tBid("notOpen")}</p>
        )}
      </div>
    );
  }

  // Non-owner client read-only summary.
  if (!isOwner) {
    return summary;
  }

  // ── Owner management view ──────────────────────────────────────────
  // Embedded FK select uses the auto-generated constraint name
  // `bids_photographer_id_fkey` (bids.photographer_id -> profiles.id).
  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id,amount_chf,message,status,photographer:profiles!bids_photographer_id_fkey(id,display_name,city,canton)"
    )
    .eq("shoot_id", id)
    .order("created_at");

  const bidList = (bids ?? []) as unknown as BidCardData[];
  const canManageBids = shoot.status === "open";

  return (
    <div className="space-y-10">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-medium tracking-tight">{shoot.title}</h1>
          <ShootStatusBadge status={shoot.status} />
        </div>

        <section className="space-y-3">
          <h2 className="label text-mute">{t("details")}</h2>
          {detailsGrid}
        </section>

        <section className="space-y-2">
          <h2 className="label text-mute">{t("brief")}</h2>
          <p className="whitespace-pre-line text-ink">{shoot.brief}</p>
        </section>

        {shoot.status === "open" ? (
          <CancelShootButton shootId={shoot.id} />
        ) : null}
      </div>

      {shoot.status === "assigned" || shoot.status === "completed" ? (
        <ContactReveal shootId={id} />
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-medium tracking-tight">{t("offers")}</h2>
        {bidList.length === 0 ? (
          <p className="text-mute">{t("noOffers")}</p>
        ) : (
          <div data-testid="bids-list" className="space-y-4">
            {bidList.map((bid) => (
              <BidCard key={bid.id} bid={bid} canManage={canManageBids} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
