import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
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

  return (
    <div className="min-h-screen bg-paper">
      <AppNav role={profile.role as "client" | "photographer"} displayName={profile.display_name ?? ""} />
      <div className="mx-auto max-w-6xl px-6 py-10 pb-24 lg:pb-10">{children}</div>
    </div>
  );
}
