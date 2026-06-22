import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCHF } from "@/lib/format";
import { AvatarUploader } from "@/components/avatar-uploader";
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

  // Photographer-only data
  const { data: details } = isPhotographer
    ? await supabase
        .from("photographer_details")
        .select(
          "specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url, verification_status, disciplines"
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
    url: supabase.storage
      .from("portfolio")
      .getPublicUrl(img.storage_path).data.publicUrl,
  }));

  // Avatar URL (stored path or external URL)
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
  // Discipline-aware professional label: video-only → Videographer, both →
  // Photographer & Videographer, else Photographer.
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

  return (
    <div className="mx-auto max-w-3xl space-y-12">
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

      {/* Bio */}
      {profile.bio && (
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-mute">
          {profile.bio}
        </p>
      )}

      {/* Account */}
      <div className="space-y-4 border-t border-line pt-8">
        <p className="label text-mute">{t("account")}</p>
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
              <dt className="text-[13px] text-mute-2">{t("termsAccepted")}</dt>
              <dd className="text-[15px] text-ink">
                {profile.terms_accepted_at.slice(0, 10)}
                {profile.terms_version ? ` · v${profile.terms_version}` : ""}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Security */}
      <div className="space-y-8 border-t border-line pt-8">
        <p className="label text-mute">{t("securityTitle")}</p>
        <div className="space-y-4">
          <h3 className="text-[15px] font-medium text-ink">
            {t("passwordTitle")}
          </h3>
          <ChangePasswordForm email={user.email ?? ""} />
        </div>
        <div className="space-y-4">
          <h3 className="text-[15px] font-medium text-ink">{t("emailTitle")}</h3>
          <ChangeEmailForm currentEmail={user.email ?? ""} />
        </div>
      </div>

      {/* Notifications */}
      <div className="space-y-3 border-t border-line pt-8">
        <p className="label text-mute">{t("notificationsTitle")}</p>
        <NotificationPrefs
          notifyBids={profile.notify_bids}
          notifyShootUpdates={profile.notify_shoot_updates}
        />
      </div>

      {/* Photographer details */}
      {isPhotographer && (
        <>
          <div className="border-t border-line pt-8">
            <VerificationRequest
              status={details?.verification_status ?? "unverified"}
            />
          </div>
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/onboarding"
              data-testid="profile-edit-details"
              className="label press text-accent hover:opacity-70"
            >
              {t("editDetails")} →
            </Link>
          </div>
          {(specialties.length > 0 ||
            coverageCantons.length > 0 ||
            details?.hourly_rate_chf != null ||
            details?.website_url ||
            details?.instagram_url) && (
            <div className="space-y-6">
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

              {details?.hourly_rate_chf != null && (
                <div className="space-y-1">
                  <p className="label text-mute">{t("hourlyRate")}</p>
                  <p className="tabular text-[15px] text-ink">
                    {t("hourlyFrom", {
                      amount: formatCHF(details.hourly_rate_chf),
                    })}
                  </p>
                </div>
              )}

              {(details?.website_url || details?.instagram_url) && (
                <div className="flex flex-wrap gap-4">
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

          {/* Portfolio (editable) */}
          <div className="space-y-4 border-t border-line pt-8">
            <PortfolioEditor initial={portfolioImages} />
            <Link
              href={`/photographers/${profile.id}`}
              className="label press inline-block text-accent hover:opacity-70"
            >
              {t("viewPublic")} →
            </Link>
          </div>

          <AvailabilityManager initial={unavailableDates} />
        </>
      )}

      <div className="space-y-2 border-t border-line pt-8">
        <p className="label text-mute">{t("dataPrivacy")}</p>
        <p className="text-[14px] text-mute">{t("exportDataHint")}</p>
        <DataExportButton />
      </div>

      <DeleteAccountButton />
    </div>
  );
}
