import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHF } from "@/lib/format";
import { AvatarUploader } from "@/components/avatar-uploader";
import { CoverUploader } from "@/components/cover-uploader";
import { PortfolioEditor } from "@/components/portfolio-editor";
import { AvailabilityManager } from "@/components/availability-manager";
import { VerificationRequest } from "@/components/verification-request";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ChangeEmailForm } from "@/components/change-email-form";
import { NotificationPrefs } from "@/components/notification-prefs";
import { DataExportButton } from "@/components/data-export-button";
import { SignOutButton } from "@/components/sign-out-button";
import { DeleteAccountButton } from "@/components/delete-account-button";

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
    <section id={id} className="scroll-mt-24 border-t border-line pt-8">
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
      "id, display_name, role, city, canton, bio, avatar_url, notify_bids, notify_shoot_updates, terms_accepted_at, terms_version"
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
  const hasVideo = proDisciplines.includes("video");
  const hasPhoto = proDisciplines.includes("photo");
  const roleLabel = !isPhotographer
    ? tAuth("roleClient")
    : hasVideo && hasPhoto
      ? tAuth("rolePhotoVideo")
      : hasVideo
        ? tAuth("roleVideographer")
        : tAuth("rolePhotographer");

  // In-page section nav (left rail).
  const navItems: { href: string; label: string }[] = [
    ...(isPhotographer
      ? [{ href: "#profile", label: t("publicProfileTitle") }]
      : []),
    { href: "#account", label: t("account") },
    { href: "#security", label: t("securityTitle") },
    { href: "#notifications", label: t("notificationsTitle") },
    { href: "#privacy", label: t("dataPrivacy") },
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
        <div className="pt-2">
          <SignOutButton showTestId={false} />
        </div>
      </div>

      {profile.bio && (
        <p className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-mute">
          {profile.bio}
        </p>
      )}

      {/* Settings: sticky section nav + content */}
      <div className="mt-10 lg:grid lg:grid-cols-[180px_1fr] lg:gap-12">
        <nav className="mb-6 lg:sticky lg:top-8 lg:mb-0 lg:self-start">
          <ul className="flex gap-x-5 gap-y-2 overflow-x-auto border-b border-line pb-2 lg:flex-col lg:border-b-0 lg:pb-0">
            {navItems.map((item) => (
              <li key={item.href} className="shrink-0">
                <a
                  href={item.href}
                  className="text-sm text-mute transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-2">
          {/* Public profile (photographer) */}
          {isPhotographer && (
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
              </div>
            </section>
          )}

          {/* Account */}
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

          {/* Security */}
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

          {/* Notifications */}
          <Section id="notifications" title={t("notificationsTitle")}>
            <NotificationPrefs
              notifyBids={profile.notify_bids}
              notifyShootUpdates={profile.notify_shoot_updates}
            />
          </Section>

          {/* Privacy */}
          <Section id="privacy" title={t("dataPrivacy")}>
            <p className="mb-3 text-[14px] text-mute">{t("exportDataHint")}</p>
            <DataExportButton />
            <div className="mt-8">
              <DeleteAccountButton />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
