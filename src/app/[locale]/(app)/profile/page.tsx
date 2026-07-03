import { getLocale, getTranslations } from "next-intl/server";
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
import { DataExportButton } from "@/components/data-export-button";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { ProfileTabs, ProfileTabPanel } from "@/components/profile-tabs";
import { ProfileChecklist } from "@/components/profile-checklist";
import { scoreProfileCompleteness } from "@/lib/profile-completeness";

export const dynamic = "force-dynamic";

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
      "id, display_name, role, city, canton, bio, avatar_url, notify_bids, notify_shoot_updates, notify_messages, terms_accepted_at, terms_version"
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
        .select("id, storage_path")
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

  const portfolioImages = (rawImages ?? []).map((img) => ({
    id: img.id,
    url: supabase.storage.from("portfolio").getPublicUrl(img.storage_path).data
      .publicUrl,
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
      ? [{ id: "profile", label: t("publicProfileTitle") }]
      : []),
    { id: "account", label: t("account") },
    { id: "security", label: t("securityTitle") },
    { id: "notifications", label: t("notificationsTitle") },
    { id: "privacy", label: t("dataPrivacy") },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
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
        <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-mute">
          {profile.bio}
        </p>
      )}

      {/* Settings — tabbed; only the active section is shown */}
      <ProfileTabs tabs={tabs}>
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
