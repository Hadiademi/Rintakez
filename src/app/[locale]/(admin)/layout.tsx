import { requireAdminProfile } from "@/lib/admin/guard";
import { SkipToContent } from "@/components/skip-to-content";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { AdminDrawer } from "@/components/admin-drawer";
import { fetchAdminCounts } from "@/lib/admin/fetch-counts";

export const dynamic = "force-dynamic";

// Admin shell. The is_admin check here is the UX gate only: Next renders each
// page segment independently of this layout, so every admin page (and
// fetchAdminCounts) runs the same requireAdminProfile() gate itself before
// touching data, and every server action re-checks admin too.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdminProfile();
  const counts = await fetchAdminCounts();

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      <SkipToContent />
      <aside className="hidden border-r border-line px-4 py-8 lg:block">
        {/* Stays CSS-hidden (not unmounted) below lg, so it can coexist with
            the drawer's own AdminSidebar while the drawer is open. Tests scope
            their queries to the drawer's testid to disambiguate the two
            copies of the nav testids that exist while the drawer is open. */}
        <AdminSidebar counts={counts} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <AdminTopbar
          displayName={profile.display_name ?? ""}
          leading={<AdminDrawer counts={counts} />}
        />
        <main id="main" className="min-w-0 px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
