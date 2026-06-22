import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { shootImage } from "@/lib/shoot-image";
import { ShootStatusBadge } from "@/components/shoot-status-badge";
import { SectionLabel } from "@/components/section-label";
import { BidCard, type BidCardData } from "@/components/bid-card";
import { ContactReveal } from "@/components/contact-reveal";
import { CancelShootButton } from "@/components/cancel-shoot-button";
import { CompleteShootButton } from "@/components/complete-shoot-button";
import { ReviewForm } from "@/components/review-form";
import { Stars } from "@/components/stars";
import { BidSheet } from "@/components/bid-sheet";
import { MyBidPanel } from "@/components/my-bid-panel";
import { ReportButton } from "@/components/report-button";
import { DisputePanel } from "@/components/dispute-panel";

export const dynamic = "force-dynamic";

export default async function ShootDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Public read-only access for anonymous visitors; actions require login.
  const profile = await getProfile();

  const supabase = await createClient();
  const { data: shoot } = await supabase
    .from("shoots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!shoot) notFound();

  // Reference images live in a PRIVATE bucket; mint short-lived signed URLs.
  // RLS on storage.objects mirrors shoot visibility, so a viewer who cannot see
  // the shoot also cannot get a signed URL.
  const { data: rawRefs } = await supabase
    .from("shoot_images")
    .select("id, storage_path")
    .eq("shoot_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const refPaths = (rawRefs ?? []).map((r) => r.storage_path);
  const { data: signedRefs } = refPaths.length
    ? await supabase.storage.from("shoot-refs").createSignedUrls(refPaths, 3600)
    : { data: [] };
  const signedByPath = new Map(
    (signedRefs ?? []).map((s) => [s.path, s.signedUrl])
  );
  const refImages = (rawRefs ?? [])
    .map((r) => ({ id: r.id, url: signedByPath.get(r.storage_path) }))
    .filter((r): r is { id: string; url: string } => !!r.url);

  // Conversation for this shoot (RLS returns it only to the two participants).
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("shoot_id", id)
    .maybeSingle();

  const tShoot = await getTranslations("shoot");
  const t = await getTranslations("shootDetail");
  const tMsg = await getTranslations("messages");
  const tMarket = await getTranslations("marketplace");

  const messageLink = conversation ? (
    <Link
      href={`/messages/${conversation.id}`}
      data-testid="open-conversation"
      className="press inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-medium text-paper"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 11.5 3 8.5 8.5 0 0 1 21 11.5z" />
      </svg>
      {tMsg("open")}
    </Link>
  ) : null;

  const isOwner = !!profile && shoot.client_id === profile.id;
  const location = `${shoot.location_city}${
    shoot.location_postcode ? ` ${shoot.location_postcode}` : ""
  }, ${shoot.canton}`;

  // Latest dispute on this shoot (RLS exposes it only to participants).
  let disputeStatus: "open" | "resolved" | "dismissed" | null = null;
  if (shoot.status === "assigned" || shoot.status === "completed") {
    const { data: latestDispute } = await supabase
      .from("disputes")
      .select("status")
      .eq("shoot_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    disputeStatus = latestDispute?.status ?? null;
  }

  const specRows: { label: string; value: string; tabular?: boolean }[] = [
    { label: tShoot("date"), value: formatSwissDate(shoot.shoot_date), tabular: true },
    { label: tShoot("location"), value: location },
    {
      label: tShoot("duration"),
      value: tShoot("hours", { count: shoot.duration_hours }),
      tabular: true,
    },
    {
      label: tShoot("budget"),
      value: formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf),
      tabular: true,
    },
    { label: tShoot("type"), value: tShoot(`types.${shoot.type}`) },
    {
      label: tShoot("discipline"),
      value: tShoot(`disciplines.${shoot.discipline}`),
    },
  ];

  const detailsGrid = (
    <dl className="border-t border-line">
      {specRows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-6 border-b border-line py-3"
        >
          <dt className="label text-mute">{row.label}</dt>
          <dd className={`text-right text-ink ${row.tabular ? "tabular" : ""}`}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );

  const hero =
    refImages.length > 0 ? (
      <div className="space-y-2">
        <div className="aspect-[16/9] w-full overflow-hidden bg-chip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={refImages[0].url}
            alt=""
            className="h-full w-full object-cover grayscale transition-[filter] duration-500 hover:grayscale-0"
          />
        </div>
        {refImages.length > 1 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {refImages.slice(1).map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.url}
                alt=""
                className="aspect-square w-full object-cover grayscale transition-[filter] duration-500 hover:grayscale-0"
              />
            ))}
          </div>
        )}
      </div>
    ) : (
      <div className="aspect-[16/9] w-full overflow-hidden bg-chip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shootImage(shoot.type, shoot.id, 1200, 675)}
          alt=""
          className="h-full w-full object-cover grayscale"
        />
      </div>
    );

  const header = (
    <div className="space-y-4">
      <div>
        <ShootStatusBadge status={shoot.status} />
      </div>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {shoot.title}
      </h1>
    </div>
  );

  const summary = (
    <div className="space-y-10">
      {hero}
      {header}

      {shoot.status === "cancelled" && shoot.cancellation_reason ? (
        <div className="border-l-2 border-accent bg-surface px-4 py-3">
          <p className="label text-mute">{t("cancelledReason")}</p>
          <p className="mt-1 whitespace-pre-line text-[14px] text-ink">
            {shoot.cancellation_reason}
          </p>
        </div>
      ) : null}

      <section>{detailsGrid}</section>

      <section className="space-y-3">
        <SectionLabel title={t("brief")} />
        <p className="whitespace-pre-line leading-relaxed text-ink">
          {shoot.brief}
        </p>
      </section>
    </div>
  );

  // ── Anonymous visitor ─────────────────────────────────────────────
  // Public read-only view; the bid wall is the login CTA.
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-10">
        {summary}
        <div className="border-t border-line pt-6">
          <Link
            href="/login"
            className="press inline-flex w-fit items-center bg-ink px-5 py-3 text-sm font-medium text-paper"
          >
            {tMarket("loginToBid")}
          </Link>
        </div>
      </div>
    );
  }

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
      <div className="mx-auto max-w-3xl space-y-10">
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
        {messageLink}
        {(shoot.status === "assigned" || shoot.status === "completed") &&
        myBid?.status === "accepted" ? (
          <div className="border-t border-line pt-6">
            <DisputePanel shootId={id} existingStatus={disputeStatus} />
          </div>
        ) : null}
        <div className="border-t border-line pt-6">
          <ReportButton targetType="shoot" targetId={id} />
        </div>
      </div>
    );
  }

  // Non-owner client read-only summary.
  if (!isOwner) {
    return <div className="mx-auto max-w-3xl">{summary}</div>;
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

  // Existing review (owner, completed shoot).
  const { data: myReview } =
    shoot.status === "completed"
      ? await supabase
          .from("reviews")
          .select("rating, comment")
          .eq("shoot_id", id)
          .maybeSingle()
      : { data: null };

  const tReview = await getTranslations("review");

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div className="space-y-10">
        {summary}

        {shoot.status === "open" ? (
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={`/shoots/${shoot.id}/edit`}
              className="press border border-line px-5 py-2.5 text-sm text-ink"
            >
              {tShoot("edit")}
            </Link>
            <CancelShootButton shootId={shoot.id} />
          </div>
        ) : null}

        {shoot.status === "assigned" ? (
          <CompleteShootButton shootId={shoot.id} />
        ) : null}
      </div>

      {shoot.status === "assigned" || shoot.status === "completed" ? (
        <div className="space-y-4">
          <ContactReveal shootId={id} />
          {messageLink}
          <a
            href={`/api/shoots/${id}/ics`}
            className="press inline-flex items-center gap-2 text-sm text-accent hover:opacity-70"
          >
            {tShoot("addToCalendar")} ↓
          </a>
          <div className="border-t border-line pt-4">
            <DisputePanel shootId={id} existingStatus={disputeStatus} />
          </div>
        </div>
      ) : null}

      {shoot.status === "completed" ? (
        <section className="space-y-4 border-t border-line pt-8">
          <SectionLabel title={tReview("title")} />
          {myReview ? (
            <div className="space-y-2" data-testid="review-summary">
              <Stars value={myReview.rating} size={18} />
              {myReview.comment ? (
                <p className="whitespace-pre-line leading-relaxed text-ink">
                  {myReview.comment}
                </p>
              ) : null}
              <p className="text-[13px] text-mute">{tReview("thanks")}</p>
            </div>
          ) : (
            <ReviewForm shootId={id} />
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionLabel title={t("offers")} />
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
