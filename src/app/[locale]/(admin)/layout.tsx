import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { SkipToContent } from "@/components/skip-to-content";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { AdminDrawer } from "@/components/admin-drawer";

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
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      <SkipToContent />
      <aside className="hidden border-r border-line px-4 py-8 lg:block">
        {/* Stays CSS-hidden (not unmounted) below lg, so it can coexist with
            the drawer's own AdminSidebar while the drawer is open. Tests scope
            their queries to the drawer's testid to disambiguate the two
            copies of the nav testids that exist while the drawer is open. */}
        <AdminSidebar />
      </aside>
      <div className="flex min-w-0 flex-col">
        <AdminTopbar
          displayName={profile.display_name ?? ""}
          leading={<AdminDrawer />}
        />
        <main id="main" className="min-w-0 px-5 py-8 sm:px-8">
          <h1 className="mb-8 text-4xl font-semibold tracking-tight text-ink">
            {t("title")}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}
