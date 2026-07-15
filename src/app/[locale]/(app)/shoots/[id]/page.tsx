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
import { Avatar } from "@/components/ui/avatar";
import { BidCard, type BidCardData } from "@/components/bid-card";
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

  // Shared avatar-path → public URL resolver (storage paths are relative;
  // externally-hosted avatars are already absolute). Used for both the
  // client card and, in the owner branch, every bidder's avatar.
  const toAvatarUrl = (path: string | null): string | null => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  };

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

  // Poster identity for the details grid's CLIENT cell + the client card.
  // Clients post public briefs, so showing the poster's name is fine for
  // every viewer, including anonymous (profiles are select-all under RLS).
  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, created_at")
    .eq("id", shoot.client_id)
    .maybeSingle();

  const tShoot = await getTranslations("shoot");
  const t = await getTranslations("shootDetail");
  const tMsg = await getTranslations("messages");
  const tMarket = await getTranslations("marketplace");
  const tProfile = await getTranslations("profile");

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
  // shoot AND the status chip's offer count. Cheap head count, owner-only —
  // RLS (bids_select_own_or_shoot_client) means a non-owner would only ever
  // see their own bid here, so the count is never fetched for them.
  const { count: bidCount } = isOwner
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

  // Hoisted out of `shoot` so the nested `budgetBox` closure below doesn't
  // need to re-narrow `shoot` past the `notFound()` null-check (TS control
  // flow narrowing doesn't carry into nested function bodies).
  const budgetRange = formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf);

  // Two-column details grid: [DATE|DURATION], [LOCATION|TYPE], [BUDGET|CLIENT].
  const gridRows: { label: string; value: string; tabular?: boolean }[][] = [
    [
      { label: tShoot("date"), value: formatSwissDate(shoot.shoot_date), tabular: true },
      {
        label: tShoot("duration"),
        value: tShoot("hours", { count: shoot.duration_hours }),
        tabular: true,
      },
    ],
    [
      { label: tShoot("location"), value: location },
      { label: tShoot("type"), value: tShoot(`types.${shoot.type}`) },
    ],
    [
      {
        label: tShoot("budget"),
        value: budgetRange,
        tabular: true,
      },
      { label: t("client"), value: clientProfile?.display_name ?? "—" },
    ],
  ];

  const detailsGrid = (
    <dl className="border-t border-line">
      {gridRows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-1 gap-x-10 gap-y-2 border-b border-line py-3 sm:grid-cols-2 sm:gap-y-0"
        >
          {row.map((cell) => (
            <div
              key={cell.label}
              className="flex items-center justify-between gap-4"
            >
              <dt className="label text-mute">{cell.label}</dt>
              <dd
                className={`text-right text-ink ${cell.tabular ? "tabular" : ""}`}
              >
                {cell.value}
              </dd>
            </div>
          ))}
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
          width={1200}
          height={675}
          // LCP hero for this page — stays eager (no loading="lazy").
          decoding="async"
          className="h-full w-full object-cover grayscale"
        />
      </div>
    );

  // Status + offer-count pill. The count only renders for the owner — RLS
  // means a photographer can only ever see their own bid and an anonymous
  // visitor sees none, so showing a count to them would be either wrong or a
  // leak of how much interest a brief has attracted.
  const statusChip = (
    <div className="label inline-flex items-center gap-2 border border-line bg-chip px-3 py-1.5 text-ink">
      <span>{tShoot(`status.${shoot.status}`)}</span>
      {isOwner ? (
        <>
          <span aria-hidden="true" className="text-mute-2">
            ·
          </span>
          <span className="tabular text-mute">
            {tShoot("bidsCount", { count: bidCount ?? 0 })}
          </span>
        </>
      ) : null}
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
    <div className="space-y-8">
      {hero}
      {statusChip}
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

  const backLink = (
    <Link
      href="/shoots"
      className="press label inline-flex items-center gap-1.5 text-mute hover:text-ink"
    >
      ‹ {t("back")}
    </Link>
  );

  const clientCard = clientProfile ? (
    <div className="flex items-center gap-4 border border-line bg-surface p-5">
      <Avatar
        name={clientProfile.display_name}
        src={toAvatarUrl(clientProfile.avatar_url)}
        size={48}
      />
      <div className="min-w-0">
        <p className="label text-mute">{t("client")}</p>
        <p className="truncate font-medium text-ink">
          {clientProfile.display_name}
        </p>
        <p className="tabular text-[13px] text-mute">
          {tProfile("memberSince", {
            year: new Date(clientProfile.created_at).getFullYear(),
          })}
        </p>
      </div>
    </div>
  ) : null;

  // Sidebar's top box: BUDGET line + (optionally) the viewer's primary action
  // rendered directly inside it, e.g. the bid sheet or the login CTA.
  function budgetBox(action: React.ReactNode) {
    return (
      <div className="space-y-6 border border-line bg-surface p-6">
        <div>
          <p className="label text-mute">{tShoot("budget")}</p>
          <p className="tabular mt-1.5 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {budgetRange}
          </p>
        </div>
        {action}
      </div>
    );
  }

  // Two-column editorial shell: shared left column (brief), sticky right
  // sidebar (deal — budget, action, offers). Collapses to a single stacked
  // column below `lg`.
  function shell(left: React.ReactNode, right: React.ReactNode) {
    return (
      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-12">
        <div className="min-w-0 space-y-10">{left}</div>
        <aside className="mt-10 space-y-6 lg:sticky lg:top-6 lg:mt-0 lg:self-start">
          {right}
        </aside>
      </div>
    );
  }

  // ── Anonymous visitor ─────────────────────────────────────────────
  // Public read-only view; the bid wall is the login CTA.
  if (!profile) {
    return shell(
      <>
        {backLink}
        {summary}
        {clientCard}
      </>,
      budgetBox(
        <Link
          href="/login"
          className="press flex items-center justify-center bg-ink px-5 py-3 text-sm font-medium text-paper"
        >
          {tMarket("loginToBid")}
        </Link>
      )
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

    const primaryAction =
      (!myBid || myBid.status === "withdrawn") && shoot.status === "open" ? (
        // No bid yet, or a withdrawn one on an open shoot — let them (re-)bid.
        <BidSheet
          shootId={id}
          budgetRange={budgetRange}
          quota={{ used, limit: Number.isFinite(limit) ? limit : null }}
        />
      ) : myBid ? (
        <MyBidPanel
          bid={myBid}
          canEdit={myBid.status === "pending" && shoot.status === "open"}
        />
      ) : (
        <p className="text-mute">{tBid("notOpen")}</p>
      );

    const accepted =
      (shoot.status === "assigned" || shoot.status === "completed") &&
      myBid?.status === "accepted";

    return shell(
      <>
        {backLink}
        {summary}
        {clientCard}
      </>,
      <>
        {budgetBox(primaryAction)}
        {accepted ? (
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
      </>
    );
  }

  // Non-owner client read-only summary — budget only, no actions, no offers.
  if (!isOwner) {
    return shell(
      <>
        {backLink}
        {summary}
        {clientCard}
      </>,
      budgetBox(null)
    );
  }

  // ── Owner management view ──────────────────────────────────────────
  // Embedded FK select uses the auto-generated constraint name
  // `bids_photographer_id_fkey` (bids.photographer_id -> profiles.id).
  // Extended with created_at + the photographer's avatar/created_at so every
  // offer card can show trust signals; BidCard ignores the extra fields
  // (RawBid is a structural superset of BidCardData). verification_status
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

  // Trust signals for every visible offer card — batched rating + verification
  // lookups, mirroring the directory's join (ratings by id in one query,
  // verification status in another). Runs for the whole card list, not just
  // when there are several to compare.
  const bidderIds = [
    ...new Set(
      visibleBids
        .map((b) => b.photographer?.id)
        .filter((x): x is string => !!x)
    ),
  ];
  const [{ data: ratings }, { data: details }] = bidderIds.length
    ? await Promise.all([
        supabase
          .from("photographer_ratings")
          .select("photographer_id, avg_rating, review_count")
          .in("photographer_id", bidderIds),
        supabase
          .from("photographer_details")
          .select("profile_id, verification_status")
          .in("profile_id", bidderIds),
      ])
    : [{ data: [] }, { data: [] }];
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

  const bidCards: BidCardData[] = visibleBids.map((b) => ({
    id: b.id,
    amount_chf: b.amount_chf,
    message: b.message,
    status: b.status,
    photographer: b.photographer
      ? {
          id: b.photographer.id,
          display_name: b.photographer.display_name,
          city: b.photographer.city,
          canton: b.photographer.canton,
        }
      : null,
    avatarUrl: b.photographer ? toAvatarUrl(b.photographer.avatar_url) : null,
    rating: b.photographer ? ratingBy.get(b.photographer.id) : undefined,
    verified: b.photographer
      ? (verifiedBy.get(b.photographer.id) ?? false)
      : false,
  }));

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

  return shell(
    <>
      {backLink}

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

      {clientCard}

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
    </>,
    <>
      {budgetBox(null)}

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

      <section className="space-y-4">
        <SectionLabel
          index={String(bidList.length).padStart(2, "0")}
          title={t("offers")}
        />
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
        ) : (
          <div data-testid="bids-list" className="space-y-4">
            {bidCards.map((bid) => (
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
    </>
  );
}
