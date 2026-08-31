import { SiteFooter } from "@/components/site-footer";

/**
 * Public group shell: appends the legal footer to every public page (login,
 * register, legal pages, contact). Before this, the footer existed only on
 * the landing page, leaving Impressum/AGB/Datenschutz unreachable from the
 * pages where a visitor actually looks for them (Swiss Impressumspflicht
 * expects them reachable from everywhere).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}
