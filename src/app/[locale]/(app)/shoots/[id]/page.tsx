import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { formatCHFRange, formatSwissDate } from "@/lib/format";
import { getBidQuotaUsage } from "@/lib/billing/entitlements";
import { shootImage } from "@/lib/shoot-image";
import { buildAlternates } from "@/lib/seo";
import { ShootStepper, type StepperHint } from "@/components/shoot-stepper";
import { SectionLabel } from "@/components/section-label";
import { BidCard, type BidCardData } from "@/components/bid-card";
import { BidCompare, type BidCompareItem } from "@/components/bid-compare";
import { ShootRefGallery } from "@/components/shoot-ref-gallery";
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

const BRIEF_DESCRIPTION_MAX_LENGTH = 160;

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  // Public client: metadata must reflect what an anonymous crawler can see,
  // not viewer-specific RLS rows (mirrors the photographer profile page).
  const supabase = createPublicClient();
  const { data: shoot } = await supabase
    .from("shoots")
    .select("title, type, brief")
    .eq("id", id)
    .maybeSingle();

  const tMeta = await getTranslations({ locale, namespace: "meta" });

  if (!shoot) {
    return {
      title: tMeta("shootFallbackTitle"),
      alternates: buildAlternates(locale, `/shoots/${id}`),
    };
  }

  const tShoot = await getTranslations({ locale, namespace: "shoot" });
  const typeLabel = tShoot(`types.${shoot.type}`);

  return {
    title: `${shoot.title} — ${typeLabel}`,
    description: shoot.brief
      ? truncate(shoot.brief, BRIEF_DESCRIPTION_MAX_LENGTH)
      : undefined,
    alternates: buildAlternates(locale, `/shoots/${id}`),
  };
}

export default async function ShootDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ imgFailed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const imgFailed = sp?.imgFailed ? parseInt(sp.imgFailed, 10) : 0;
  // Public read-only access for anonymous visitors; actions require login.
  const profile = await getProfile();

  const supabase = await createClient();
  const { data: shoot } = await supabase
    .from("shoots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!shoot) notFound();

  // Whether a review exists — drives the stepper's terminal "Bewertet" step for
  // EVERY viewer (reviews are world-readable). Cheap head count; the owner's
  // full review load below is unchanged.
  const { count: reviewCount } =
    shoot.status === "completed"
      ? await supabase
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("shoot_id", id)
      : { count: 0 };
  const hasReview = (reviewCount ?? 0) > 0;

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

  // Bid presence drives the owner's "invite photographers" pointer on an open
  // shoot. Cheap head count, owner-only.
  const { count: bidCount } =
    isOwner && shoot.status === "open"
      ? await supabase
          .from("bids")
          .select("id", { count: "exact", head: true })
          .eq("shoot_id", id)
      : { count: null };

  // The stepper's single contextual line: it only names the next action for the
  // owner. The real CTAs (invite link, CompleteShootButton, ReviewForm) live
  // below and own their own logic — this is just a pointer.
  const stepperHint: StepperHint | null = !isOwner
    ? null
    : shoot.status === "open"
      ? (bidCount ?? 0) === 0
        ? "invite"
        : null
      : shoot.status === "assigned"
        ? "contact"
        : shoot.status === "completed" && !hasReview
          ? "review"
          : null;

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
      <ShootRefGallery images={refImages} />
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
      <ShootStepper
        status={shoot.status}
        hasReview={hasReview}
        hint={stepperHint}
      />
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
    const { used, limit } = await getBidQuotaUsage(supabase, profile.id, new Date());

    return (
      <div className="mx-auto max-w-3xl space-y-10">
        {summary}
        {(!myBid || myBid.status === "withdrawn") &&
        shoot.status === "open" ? (
          // No bid yet, or a withdrawn one on an open shoot — let them (re-)bid.
          <BidSheet
            shootId={id}
            budgetRange={formatCHFRange(
              shoot.budget_min_chf,
              shoot.budget_max_chf
            )}
            quota={{ used, limit: Number.isFinite(limit) ? limit : null }}
          />
        ) : myBid ? (
          <MyBidPanel
            bid={myBid}
            canEdit={myBid.status === "pending" && shoot.status === "open"}
          />
        ) : (
          <p className="text-mute">{tBid("notOpen")}</p>
        )}
        {(shoot.status === "assigned" || shoot.status === "completed") &&
        myBid?.status === "accepted" ? (
          <div className="space-y-4">
            {/* Symmetric with the client view: the winning photographer also
                gets the client's contact, the message thread and a calendar
                file (the ICS route and get_counterparty_email both authorize
                the assigned photographer). */}
            <ContactReveal shootId={id} />
            {messageLink}
            <a
              href={`/api/shoots/${id}/ics`}
              className="press inline-flex items-center gap-2 text-sm text-accent hover:opacity-70"
            >
              {tShoot("addToCalendar")} ↓
            </a>
            <div className="border-t border-line pt-6">
              <DisputePanel shootId={id} existingStatus={disputeStatus} />
            </div>
          </div>
        ) : (
          messageLink
        )}
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
  // Extended with created_at + the photographer's avatar/created_at so the
  // owner's comparison grid can show trust signals; BidCard ignores the extra
  // fields (RawBid is a structural superset of BidCardData). verification_status
  // lives on photographer_details, so it's batch-fetched separately below.
  const { data: bids } = await supabase
    .from("bids")
    .select(
      "id,amount_chf,message,status,created_at,photographer:profiles!bids_photographer_id_fkey(id,display_name,city,canton,avatar_url,created_at)"
    )
    .eq("shoot_id", id)
    .order("created_at");

  type RawBid = BidCardData & {
    created_at: string;
    photographer:
      | (NonNullable<BidCardData["photographer"]> & {
          avatar_url: string | null;
          created_at: string;
        })
      | null;
  };

  const bidList = (bids ?? []) as unknown as RawBid[];
  const canManageBids = shoot.status === "open";
  // Declutter the decision view: while open, show only the offers the client can
  // still act on (pending); once decided, only the accepted one. Declined and
  // withdrawn offers collapse into a small count so they don't bury the choice.
  const visibleBids = canManageBids
    ? bidList.filter((b) => b.status === "pending")
    : bidList.filter((b) => b.status === "accepted");
  const hiddenBidCount = bidList.length - visibleBids.length;

  // Comparison grid — only when the owner has ≥2 pending offers to weigh.
  // Mirrors the directory's batched trust join: ratings by id in one query,
  // completed-shoots count once per bidder (small N). Built only when it renders.
  const showCompare = canManageBids && visibleBids.length >= 2;
  let compareItems: BidCompareItem[] = [];
  if (showCompare) {
    const bidderIds = [
      ...new Set(
        visibleBids
          .map((b) => b.photographer?.id)
          .filter((x): x is string => !!x)
      ),
    ];
    const [{ data: ratings }, { data: details }] = await Promise.all([
      bidderIds.length
        ? supabase
            .from("photographer_ratings")
            .select("photographer_id, avg_rating, review_count")
            .in("photographer_id", bidderIds)
        : Promise.resolve({ data: [] }),
      bidderIds.length
        ? supabase
            .from("photographer_details")
            .select("profile_id, verification_status")
            .in("profile_id", bidderIds)
        : Promise.resolve({ data: [] }),
    ]);
    const ratingBy = new Map(
      (ratings ?? []).map((r) => [
        r.photographer_id,
        { avg: r.avg_rating ?? 0, count: r.review_count ?? 0 },
      ])
    );
    const verifiedBy = new Map(
      (details ?? []).map((d) => [
        d.profile_id,
        d.verification_status === "verified",
      ])
    );
    const counts = await Promise.all(
      bidderIds.map((pid) =>
        supabase.rpc("photographer_completed_shoots_count", {
          p_photographer_id: pid,
        })
      )
    );
    const countBy = new Map(
      bidderIds.map((pid, i) => [pid, counts[i].data ?? 0])
    );

    const avatarUrl = (path: string | null): string | null => {
      if (!path) return null;
      if (path.startsWith("http://") || path.startsWith("https://")) return path;
      return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    };

    compareItems = visibleBids.map((b) => {
      const ph = b.photographer;
      return {
        id: b.id,
        amount_chf: b.amount_chf,
        message: b.message,
        createdAt: b.created_at,
        photographer: ph
          ? {
              id: ph.id,
              display_name: ph.display_name,
              avatarUrl: avatarUrl(ph.avatar_url),
              verified: verifiedBy.get(ph.id) ?? false,
              memberSinceYear: new Date(ph.created_at).getFullYear(),
            }
          : null,
        rating: (ph && ratingBy.get(ph.id)) || { avg: 0, count: 0 },
        completedShoots: (ph && countBy.get(ph.id)) ?? 0,
      };
    });
  }

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
        {imgFailed > 0 ? (
          <div
            data-testid="ref-upload-warning"
            className="border-l-2 border-accent bg-surface px-4 py-3 text-[14px] text-ink"
          >
            {t("refUploadFailed", { count: imgFailed })}
          </div>
        ) : null}

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
          <div className="space-y-4">
            <p className="text-mute">{t("noOffers")}</p>
            {shoot.status === "open" ? (
              <Link
                href={`/photographers?canton=${shoot.canton}&type=${shoot.type}`}
                data-testid="find-photographers-cta"
                className="press inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-medium text-paper"
              >
                {tShoot("findPhotographersCta")}
              </Link>
            ) : null}
          </div>
        ) : visibleBids.length === 0 ? (
          <p className="text-mute">
            {hiddenBidCount > 0
              ? t("pastOffers", { count: hiddenBidCount })
              : t("noOffers")}
          </p>
        ) : showCompare ? (
          <div className="space-y-4">
            <BidCompare bids={compareItems} />
            {hiddenBidCount > 0 ? (
              <p className="text-[13px] text-mute-2">
                {t("pastOffers", { count: hiddenBidCount })}
              </p>
            ) : null}
          </div>
        ) : (
          <div data-testid="bids-list" className="space-y-4">
            {visibleBids.map((bid) => (
              <BidCard key={bid.id} bid={bid} canManage={canManageBids} />
            ))}
            {hiddenBidCount > 0 ? (
              <p className="text-[13px] text-mute-2">
                {t("pastOffers", { count: hiddenBidCount })}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
