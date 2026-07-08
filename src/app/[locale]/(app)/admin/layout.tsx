import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { AdminTabs } from "@/components/admin-tabs";

export const dynamic = "force-dynamic";

// Central admin gate for every /admin/* route. Individual server actions also
// re-check admin (defense-in-depth), so this is the UX gate, not the only one.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (!profile.is_admin) {
    redirect({ href: "/home", locale });
    return null;
  }

  const t = await getTranslations("admin");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">
        {t("title")}
      </h1>
      <AdminTabs />
      {children}
    </div>
  );
}
