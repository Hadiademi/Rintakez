import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { PublicNav } from "@/components/public-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  // Anonymous visitors may browse the public marketplace pages in this group
  // (open shoots, shoot detail, photographer directory). Private pages
  // (home, my-shoots, my-bids, profile, onboarding, messages, admin, shoots/new)
  // are gated by middleware, so an anon request never reaches them here.
  if (!profile) {
    return (
      <div className="min-h-screen bg-paper">
        <PublicNav />
        <div className="mx-auto max-w-7xl px-5 py-10 pb-24 sm:px-8 lg:pb-10">
          {children}
        </div>
      </div>
    );
  }

  // Resolve avatar (stored path or external URL) to a public URL for the nav.
  let avatarUrl: string | null = null;
  if (profile.avatar_url) {
    const raw = profile.avatar_url;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      avatarUrl = raw;
    } else {
      const supabase = await createClient();
      avatarUrl = supabase.storage.from("avatars").getPublicUrl(raw).data
        .publicUrl;
    }
  }

  let suspendedBanner: string | null = null;
  if (profile.is_suspended) {
    const t = await getTranslations("account");
    suspendedBanner = profile.suspension_reason
      ? `${t("suspendedBanner")} ${profile.suspension_reason}`
      : t("suspendedBanner");
  }

  return (
    <div className="min-h-screen bg-paper">
      <AppNav
        role={profile.role as "client" | "photographer"}
        displayName={profile.display_name ?? ""}
        userId={profile.id}
        avatarUrl={avatarUrl}
        isAdmin={profile.is_admin}
      />
      {suspendedBanner ? (
        <div
          role="alert"
          className="border-b border-red-300 bg-red-50 px-5 py-3 text-center text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {suspendedBanner}
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl px-5 py-10 pb-24 sm:px-8 lg:pb-10">{children}</div>
    </div>
  );
}
