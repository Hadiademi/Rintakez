import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    // redirect() never returns; this satisfies TypeScript
    return null;
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

  return (
    <div className="min-h-screen bg-paper">
      <AppNav
        role={profile.role as "client" | "photographer"}
        displayName={profile.display_name ?? ""}
        userId={profile.id}
        avatarUrl={avatarUrl}
      />
      <div className="mx-auto max-w-7xl px-5 py-10 pb-24 sm:px-8 lg:pb-10">{children}</div>
    </div>
  );
}
