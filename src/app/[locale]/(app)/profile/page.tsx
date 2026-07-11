import { getLocale, getTranslations, getFormatter } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHF, formatSwissDate } from "@/lib/format";
import { Stars } from "@/components/stars";
import { ReviewReplyForm } from "@/components/review-reply-form";
import { AvatarUploader } from "@/components/avatar-uploader";
import { CoverUploader } from "@/components/cover-uploader";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { AvailabilityManager } from "@/components/availability-manager";
import { VerificationRequest } from "@/components/verification-request";
import { ProfileBasicsEditor } from "@/components/profile-basics-editor";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ChangeEmailForm } from "@/components/change-email-form";
import { NotificationPrefs } from "@/components/notification-prefs";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { DataExportButton } from "@/components/data-export-button";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { BillingPortalButton } from "@/components/billing-portal-button";
import { ProfileTabs, ProfileTabPanel } from "@/components/profile-tabs";
import { ProfileChecklist } from "@/components/profile-checklist";
import { scoreProfileCompleteness } from "@/lib/profile-completeness";
import { effectivePlan, getBidQuotaUsage } from "@/lib/billing/entitlements";
import type { Plan } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

// ── Mobile account-hub primitives ──────────────────────────────────────────

function HubIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    person: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="1.5" />
        <path d="M3 10h18" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="1.5" />
        <path d="M4 9h16M8 3v4M16 3v4" />
      </>
    ),
    star: (
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="1.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.4 3.6 8.5S14.4 18.1 12 20.5C9.6 18.1 8.4 15.1 8.4 12S9.6 5.9 12 3.5z" />
      </>
    ),
    shield: <path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" />,
    logout: (
      <>
        <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
        <path d="M10 8l-4 4 4 4M6 12h11" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-mute-2"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/**
 * One tappable hub row. Hash targets (#account …) MUST use a native <a> so the
 * browser fires `hashchange`, which ProfileTabs listens on to switch panels; a
 * soft-navigating i18n <Link> would not. Route targets pass `useLink`.
 */
function HubRow({
  href,
  icon,
  label,
  state,
  useLink,
}: {
  href: string;
  icon: string;
  label: string;
  state?: string;
  useLink?: boolean;
}) {
  const className =
    "press flex min-h-14 items-center gap-4 border-b border-line px-1 py-4 text-ink";
  const inner = (
    <>
      <span className="text-ink">
        <HubIcon name={icon} />
      </span>
      <span className="flex-1 text-[15px] text-ink">{label}</span>
      {state ? <span className="label text-mute">{state}</span> : null}
      <Chevron />
    </>
  );
  if (useLink) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {inner}
    </a>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="label mb-5 text-mute">{title}</h2>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const [user, locale] = await Promise.all([getSessionUser(), getLocale()]);

  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, role, city, canton, bio, avatar_url, notify_bids, notify_shoot_updates, notify_messages, terms_accepted_at, terms_version, created_at"
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  const isPhotographer = profile.role === "photographer";

  const { data: details } = isPhotographer
    ? await supabase
        .from("photographer_details")
        .select(
          "specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url, verification_status, disciplines, cover_path"
        )
        .eq("profile_id", profile.id)
        .maybeSingle()
    : { data: null };

  const { data: rawImages } = isPhotographer
    ? await supabase
        .from("portfolio_images")
        .select("id, storage_path, caption")
        .eq("photographer_id", profile.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: unavailableRows } = isPhotographer
    ? await supabase
        .from("photographer_unavailable")
        .select("date")
        .eq("photographer_id", profile.id)
        .order("date", { ascending: true })
    : { data: [] };
  const unavailableDates = (unavailableRows ?? []).map((r) => r.date);

  // The photographer's own reviews — so they can post a single public reply.
  const { data: reviewRows } = isPhotographer
    ? await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reply, reply_at")
        .eq("photographer_id", profile.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  const reviews = reviewRows ?? [];

  // Billing tab (photographer only) — one extra query for the subscriptions
  // row (source of cancel_at_period_end / stripe_customer_id, which
  // getEntitlement() doesn't expose), reusing the same pure effectivePlan()
  // resolution getEntitlement() wraps so we don't pay for a second query.
  type BillingSubRow = {
    plan: Plan;
    status: string;
    source: "stripe" | "admin_comp";
    current_period_end: string | null;
    comp_until: string | null;
    cancel_at_period_end: boolean;
    stripe_customer_id: string | null;
  } | null;

  const { data: subRow } = isPhotographer
    ? ((await supabase
        .from("subscriptions")
        .select(
          "plan, status, source, current_period_end, comp_until, cancel_at_period_end, stripe_customer_id"
        )
        .eq("user_id", profile.id)
        .maybeSingle()) as { data: BillingSubRow })
    : { data: null as BillingSubRow };

  const entitlement = isPhotographer ? effectivePlan(subRow, new Date()) : null;
  const quota = isPhotographer
    ? await getBidQuotaUsage(supabase, profile.id, new Date())
    : null;

  const portfolioImages = (rawImages ?? []).map((img) => ({
    id: img.id,
    url: supabase.storage.from("portfolio").getPublicUrl(img.storage_path).data
      .publicUrl,
    caption: img.caption ?? null,
  }));

  const coverUrl = details?.cover_path
    ? supabase.storage.from("portfolio").getPublicUrl(details.cover_path).data
        .publicUrl
    : null;

  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const raw = profile.avatar_url;
    avatarUrl =
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : supabase.storage.from("avatars").getPublicUrl(raw).data.publicUrl;
  }

  const t = await getTranslations("profile");
  const tAuth = await getTranslations("auth");
  const tShoot = await getTranslations("shoot");
  const tReview = await getTranslations("review");
  const tBilling = await getTranslations("billing");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();

  // Endonyms (same in every UI locale) — shown as the Language row's state.
  const languageNames: Record<string, string> = {
    de: "Deutsch",
    en: "English",
    fr: "Français",
  };
  const currentLanguage = languageNames[locale] ?? locale.toUpperCase();

  // "Mitglied seit {Month YYYY}" — localized month + year from profile signup.
  const memberSince = profile.created_at
    ? format.dateTime(new Date(profile.created_at), {
        month: "long",
        year: "numeric",
      })
    : null;

  // ── Account-hub stat tiles (mobile). Real COUNTS only — we do not process
  // shoot payments, so there is no spending/earnings figure to show. ──
  type HubStat = { value: number; label: string };
  let hubStats: HubStat[] = [];
  if (isPhotographer) {
    const [completedRes, bidsRes] = await Promise.all([
      // Completed jobs: crosses RLS via the SECURITY DEFINER count function
      // (shoots/bids aren't self-readable across the accepted-photographer edge).
      supabase.rpc("photographer_completed_shoots_count", {
        p_photographer_id: profile.id,
      }),
      supabase
        .from("bids")
        .select("id", { count: "exact", head: true })
        .eq("photographer_id", profile.id),
    ]);
    hubStats = [
      {
        value: (completedRes.data as number | null) ?? 0,
        label: t("statAuftraege"),
      },
      // reviews received — already fetched above for the reply UI.
      { value: reviews.length, label: tReview("reviews") },
      { value: bidsRes.count ?? 0, label: t("statAngebote") },
    ];
  } else {
    const [allRes, bookedRes, reviewsRes] = await Promise.all([
      supabase
        .from("shoots")
        .select("id", { count: "exact", head: true })
        .eq("client_id", profile.id),
      supabase
        .from("shoots")
        .select("id", { count: "exact", head: true })
        .eq("client_id", profile.id)
        .in("status", ["assigned", "completed"]),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("client_id", profile.id),
    ]);
    hubStats = [
      { value: bookedRes.count ?? 0, label: t("statBuchungen") },
      { value: allRes.count ?? 0, label: t("statShoots") },
      { value: reviewsRes.count ?? 0, label: tReview("reviews") },
    ];
  }

  const initials = profile.display_name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const specialties = details?.specialties ?? [];
  const coverageCantons = details?.coverage_cantons ?? [];
  const proDisciplines = details?.disciplines ?? [];

  const completeness = isPhotographer
    ? scoreProfileCompleteness({
        hasAvatar: Boolean(profile.avatar_url),
        bioLength: profile.bio?.length ?? 0,
        portfolioCount: portfolioImages.length,
        hasRate: (details?.hourly_rate_chf ?? 0) > 0,
        cantonsCount: coverageCantons.length,
        specialtiesCount: specialties.length,
        verificationStatus: details?.verification_status ?? "unverified",
      })
    : null;
  const hasVideo = proDisciplines.includes("video");
  const hasPhoto = proDisciplines.includes("photo");
  const roleLabel = !isPhotographer
    ? tAuth("roleClient")
    : hasVideo && hasPhoto
      ? tAuth("rolePhotoVideo")
      : hasVideo
        ? tAuth("roleVideographer")
        : tAuth("rolePhotographer");

  // Settings tabs — only the selected one is shown (see ProfileTabs).
  const tabs: { id: string; label: string }[] = [
    ...(isPhotographer
      ? [
          { id: "profile", label: t("publicProfileTitle") },
          { id: "billing", label: t("billingTitle") },
        ]
      : []),
    { id: "account", label: t("account") },
    { id: "security", label: t("securityTitle") },
    { id: "notifications", label: t("notificationsTitle") },
    { id: "privacy", label: t("dataPrivacy") },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Mobile account hub (lg:hidden) — replaces the tabbed hero on phones.
          Real data/counts only; no CHF spending stat, no dual-role card. ── */}
      <div className="lg:hidden" data-testid="profile-mobile-hub">
        {/* Hero */}
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <AvatarUploader initialUrl={avatarUrl} initials={initials} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
              {profile.display_name}
            </h1>
            {memberSince && (
              <p className="mt-0.5 text-[13px] text-mute">
                {t("memberSinceDate", { date: memberSince })}
              </p>
            )}
            <a
              href="#account"
              className="press label mt-2 inline-flex items-center gap-1.5 text-accent"
            >
              <svg
                aria-hidden="true"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                <path d="M13.5 8l2.5 2.5" />
              </svg>
              {t("edit")}
            </a>
          </div>
        </div>

        {/* Stats — 3 real KPI tiles */}
        <div
          data-testid="profile-hub-stats"
          className="mt-6 grid grid-cols-3 divide-x divide-line border-y border-line"
        >
          {hubStats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center px-2 py-4 text-center"
            >
              <span className="tabular text-2xl font-semibold text-ink">
                {s.value}
              </span>
              <span className="label mt-1 text-mute">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Primary menu list */}
        <div className="mt-8">
          <HubRow href="#account" icon="person" label={t("account")} />
          {isPhotographer && (
            <HubRow href="#billing" icon="card" label={t("billingTitle")} />
          )}
          <HubRow
            href={isPhotographer ? "/my-bids" : "/my-shoots"}
            icon="calendar"
            label={isPhotographer ? tNav("myBids") : tNav("myShoots")}
            useLink
          />
          {isPhotographer && (
            <HubRow href="#profile" icon="star" label={tReview("reviews")} />
          )}
          <HubRow href="#security" icon="lock" label={t("securityTitle")} />
        </div>

        {/* Dark promo card — real promo (Abo upsell / post-a-shoot), NOT dual-role */}
        {isPhotographer
          ? entitlement &&
            quota && (
              <section
                aria-label={t("billingTitle")}
                data-testid="profile-hub-promo"
                className="mt-8 bg-ink p-6 text-paper"
              >
                <p className="label text-paper/50">{tNav("subscription")}</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-paper">
                  {entitlement.isActive
                    ? tBilling(`plan.${entitlement.plan}.name`)
                    : t("upsellTitle")}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-paper/70">
                  {t("upsellBody")}
                </p>
                <p className="tabular mt-1 text-[13px] text-paper/60">
                  {quota.limit === Infinity
                    ? t("billingUsageUnlimited")
                    : t("billingUsage", { used: quota.used, limit: quota.limit })}
                </p>
                {/* Native anchor: a browser fragment nav fires `hashchange`,
                    which ProfileTabs listens on to switch to the Billing tab. */}
                <a
                  href="#billing"
                  className="press label mt-5 inline-flex min-h-11 items-center justify-center bg-paper px-5 text-ink"
                >
                  {entitlement.isActive
                    ? t("billingManage")
                    : t("billingViewPlans")}
                </a>
              </section>
            )
          : (
            <section
              aria-label={t("postShootCta")}
              data-testid="profile-hub-promo"
              className="mt-8 bg-ink p-6 text-paper"
            >
              <p className="label text-paper/50">{t("promoClientEyebrow")}</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-paper">
                {t("postShootCta")}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-paper/70">
                {t("promoClientBody")}
              </p>
              <Link
                href="/shoots/new"
                className="press label mt-5 inline-flex min-h-11 items-center justify-center bg-paper px-5 text-ink"
              >
                {t("postShootCta")}
              </Link>
            </section>
          )}

        {/* Secondary settings group */}
        <div className="mt-8">
          <HubRow
            href="#notifications"
            icon="bell"
            label={tNav("notifications")}
          />
          {/* Language — surfaces the existing LocaleSwitcher; the current
              language name is shown, and the select stays fully functional. */}
          <div className="flex min-h-14 items-center gap-4 border-b border-line px-1 py-4">
            <span className="text-ink">
              <HubIcon name="globe" />
            </span>
            <span className="flex-1 text-[15px] text-ink">{t("language")}</span>
            <span className="label text-mute">{currentLanguage}</span>
            <LocaleSwitcher />
          </div>
          <HubRow href="#privacy" icon="shield" label={t("dataPrivacy")} />
          {/* Log out — reuses SignOutButton's real sign-out action. */}
          <div className="flex min-h-14 items-center gap-4 px-1 py-4 text-mute">
            <span className="text-mute">
              <HubIcon name="logout" />
            </span>
            <div className="flex-1">
              <SignOutButton showTestId={false} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Desktop header (hidden on mobile — the hub replaces it) ── */}
      <div className="hidden items-start justify-between gap-6 lg:flex">
        <div className="flex items-start gap-5">
          <div className="shrink-0">
            <AvatarUploader initialUrl={avatarUrl} initials={initials} />
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <span className="label text-mute">{roleLabel}</span>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">
              {profile.display_name}
            </h1>
            {(profile.city || profile.canton) && (
              <p className="text-[14px] text-mute">
                {[profile.city, profile.canton].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {profile.bio && (
        <p className="mt-6 hidden whitespace-pre-line text-[15px] leading-relaxed text-mute lg:block">
          {profile.bio}
        </p>
      )}

      {/* Settings — tabbed on desktop; on mobile the tab bar is hidden and the
          hub above drives the panels via hash links. */}
      <ProfileTabs tabs={tabs} hideBarOnMobile>
        {/* Public profile (photographer) */}
        {isPhotographer && (
          <ProfileTabPanel id="profile" label={t("publicProfileTitle")}>
            {completeness && (
              <div className="mb-8">
                <ProfileChecklist result={completeness} />
              </div>
            )}
            <section id="profile" className="scroll-mt-24">
              <div className="flex items-center justify-between gap-4">
                <h2 className="label text-mute">{t("publicProfileTitle")}</h2>
                <Link
                  href={`/photographers/${profile.id}`}
                  className="label press text-accent hover:opacity-70"
                >
                  {t("viewPublic")} →
                </Link>
              </div>

              <div className="mt-5 space-y-8">
                <ProfileBasicsEditor
                  displayName={profile.display_name}
                  city={profile.city ?? ""}
                  canton={profile.canton ?? ""}
                  bio={profile.bio ?? ""}
                />

                <CoverUploader initialUrl={coverUrl} />

                <VerificationRequest
                  status={details?.verification_status ?? "unverified"}
                />

                {(specialties.length > 0 ||
                  coverageCantons.length > 0 ||
                  details?.hourly_rate_chf != null ||
                  details?.website_url ||
                  details?.instagram_url) && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {(details?.disciplines ?? []).length > 0 && (
                      <div className="space-y-2">
                        <p className="label text-mute">{t("disciplines")}</p>
                        <div className="flex flex-wrap gap-2">
                          {(details?.disciplines ?? []).map((d) => (
                            <span
                              key={d}
                              className="rounded-full border border-line px-3 py-1 text-[13px] text-ink"
                            >
                              {tShoot(`disciplines.${d}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {details?.hourly_rate_chf != null && (
                      <div className="space-y-2">
                        <p className="label text-mute">{t("hourlyRate")}</p>
                        <p className="tabular text-[15px] text-ink">
                          {t("hourlyFrom", {
                            amount: formatCHF(details.hourly_rate_chf),
                          })}
                        </p>
                      </div>
                    )}

                    {specialties.length > 0 && (
                      <div className="space-y-2">
                        <p className="label text-mute">{t("specialties")}</p>
                        <div className="flex flex-wrap gap-2">
                          {specialties.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-chip px-3 py-1 text-[13px] text-ink"
                            >
                              {tShoot(`types.${s}`)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {coverageCantons.length > 0 && (
                      <div className="space-y-2">
                        <p className="label text-mute">{t("coverage")}</p>
                        <div className="flex flex-wrap gap-2">
                          {coverageCantons.map((canton) => (
                            <span
                              key={canton}
                              className="rounded-full bg-chip px-3 py-1 text-[13px] text-ink"
                            >
                              {canton}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {(details?.website_url || details?.instagram_url) && (
                      <div className="flex flex-wrap gap-4 sm:col-span-2">
                        {details.website_url && (
                          <a
                            href={details.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[14px] text-accent underline underline-offset-2 hover:opacity-70"
                          >
                            {t("website")}
                          </a>
                        )}
                        {details.instagram_url && (
                          <a
                            href={details.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[14px] text-accent underline underline-offset-2 hover:opacity-70"
                          >
                            {t("instagram")}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Link
                    href="/onboarding"
                    data-testid="profile-edit-details"
                    className="label press text-accent hover:opacity-70"
                  >
                    {t("editDetails")} →
                  </Link>
                </div>

                <PortfolioEditor initial={portfolioImages} />
                <AvailabilityManager initial={unavailableDates} />

                {/* Reviews — the photographer may post one public reply each. */}
                <div className="space-y-5 border-t border-line pt-8">
                  <p className="label text-mute">{tReview("reviews")}</p>
                  {reviews.length > 0 ? (
                    <ul className="space-y-6">
                      {reviews.map((r) => (
                        <li key={r.id} className="space-y-1.5">
                          <Stars value={r.rating} />
                          {r.comment ? (
                            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
                              {r.comment}
                            </p>
                          ) : null}
                          <p className="tabular text-[13px] text-mute">
                            {formatSwissDate(r.created_at.slice(0, 10))}
                          </p>
                          {r.reply ? (
                            <div className="mt-2 space-y-1 border-l-2 border-line pl-4">
                              <p className="label text-mute-2">
                                {tReview("replyFrom", {
                                  name: profile.display_name,
                                })}
                              </p>
                              <p className="whitespace-pre-line text-[15px] leading-relaxed text-mute">
                                {r.reply}
                              </p>
                            </div>
                          ) : (
                            <ReviewReplyForm reviewId={r.id} />
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[14px] text-mute">
                      {tReview("noReviews")}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </ProfileTabPanel>
        )}

        {/* Billing (photographer) */}
        {isPhotographer && entitlement && (
          <ProfileTabPanel id="billing" label={t("billingTitle")}>
            <Section id="billing" title={t("billingTitle")}>
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="label text-mute">{t("billingCurrentPlan")}</p>
                  <p className="text-[15px] text-ink">
                    {entitlement.isActive
                      ? tBilling(`plan.${entitlement.plan}.name`)
                      : t("billingFreePlan")}
                  </p>
                </div>

                {entitlement.isActive &&
                entitlement.source === "admin_comp" &&
                entitlement.expiresAt ? (
                  <p className="text-[15px] text-mute">
                    {t("billingSourceComp", {
                      date: formatSwissDate(
                        entitlement.expiresAt.toISOString().slice(0, 10)
                      ),
                    })}
                  </p>
                ) : null}

                {entitlement.isActive &&
                entitlement.source === "stripe" &&
                entitlement.expiresAt ? (
                  <div className="space-y-1">
                    <p className="text-[15px] text-mute">
                      {subRow?.cancel_at_period_end
                        ? t("billingSourceStripeEnds", {
                            date: formatSwissDate(
                              entitlement.expiresAt.toISOString().slice(0, 10)
                            ),
                          })
                        : t("billingSourceStripeRenews", {
                            date: formatSwissDate(
                              entitlement.expiresAt.toISOString().slice(0, 10)
                            ),
                          })}
                    </p>
                    {subRow?.cancel_at_period_end ? (
                      <p className="text-[15px] text-accent">
                        {t("billingCancelNotice")}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {quota ? (
                  <p className="tabular text-[15px] text-ink">
                    {quota.limit === Infinity
                      ? t("billingUsageUnlimited")
                      : t("billingUsage", {
                          used: quota.used,
                          limit: quota.limit,
                        })}
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  {subRow?.stripe_customer_id ? <BillingPortalButton /> : null}
                  <Link
                    href="/pricing"
                    className="press border border-line px-4 py-3 label text-ink"
                  >
                    {t("billingViewPlans")}
                  </Link>
                </div>
              </div>
            </Section>
          </ProfileTabPanel>
        )}

        {/* Account */}
        <ProfileTabPanel id="account" label={t("account")}>
          <Section id="account" title={t("account")}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-[13px] text-mute-2">{tAuth("email")}</dt>
                <dd className="text-[15px] text-ink">{user.email}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-[13px] text-mute-2">{t("role")}</dt>
                <dd className="text-[15px] text-ink">{roleLabel}</dd>
              </div>
              {profile.terms_accepted_at && (
                <div className="space-y-1">
                  <dt className="text-[13px] text-mute-2">
                    {t("termsAccepted")}
                  </dt>
                  <dd className="text-[15px] text-ink">
                    {profile.terms_accepted_at.slice(0, 10)}
                    {profile.terms_version
                      ? ` · v${profile.terms_version}`
                      : ""}
                  </dd>
                </div>
              )}
            </dl>
          </Section>
        </ProfileTabPanel>

        {/* Security */}
        <ProfileTabPanel id="security" label={t("securityTitle")}>
          <Section id="security" title={t("securityTitle")}>
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-[15px] font-medium text-ink">
                  {t("passwordTitle")}
                </h3>
                <ChangePasswordForm email={user.email ?? ""} />
              </div>
              <div className="space-y-4">
                <h3 className="text-[15px] font-medium text-ink">
                  {t("emailTitle")}
                </h3>
                <ChangeEmailForm currentEmail={user.email ?? ""} />
              </div>
            </div>
          </Section>
        </ProfileTabPanel>

        {/* Notifications */}
        <ProfileTabPanel id="notifications" label={t("notificationsTitle")}>
          <Section id="notifications" title={t("notificationsTitle")}>
            <NotificationPrefs
              notifyBids={profile.notify_bids}
              notifyShootUpdates={profile.notify_shoot_updates}
              notifyMessages={profile.notify_messages}
            />
          </Section>
        </ProfileTabPanel>

        {/* Privacy */}
        <ProfileTabPanel id="privacy" label={t("dataPrivacy")}>
          <Section id="privacy" title={t("dataPrivacy")}>
            <p className="mb-3 text-[14px] text-mute">{t("exportDataHint")}</p>
            <DataExportButton />
            <div className="mt-8">
              <DeleteAccountButton />
            </div>
          </Section>
        </ProfileTabPanel>
      </ProfileTabs>
    </div>
  );
}
