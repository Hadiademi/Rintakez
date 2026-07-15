"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";

/**
 * Admin navigation, grouped the way the design's own eyebrow labels imply.
 * Entries are added only when their page exists — a nav link to a 404 is a bug.
 */
const ADMIN_NAV = [
  {
    sectionKey: "sectionOverview",
    items: [{ href: "/admin", labelKey: "tabDashboard" }],
  },
  {
    sectionKey: "sectionMarketplace",
    items: [{ href: "/admin/users", labelKey: "tabUsers" }],
  },
  {
    sectionKey: "sectionModeration",
    items: [
      { href: "/admin/reports", labelKey: "tabReports" },
      { href: "/admin/verifications", labelKey: "tabVerifications" },
      { href: "/admin/disputes", labelKey: "tabDisputes" },
    ],
  },
  {
    sectionKey: "sectionSystem",
    items: [
      { href: "/admin/audit", labelKey: "tabAudit" },
      { href: "/admin/email", labelKey: "tabEmail" },
    ],
  },
] as const;

export function AdminSidebar({
  showTestIds = true,
}: {
  /**
   * The desktop rail and the mobile drawer both render this component, and
   * the rail stays mounted (CSS-hidden, not unmounted) below `lg` so it can
   * coexist with the drawer's copy while the drawer is open. Two elements
   * sharing the same static testid trips Playwright strict mode, so the
   * rail's instance opts out — same pattern as SignOutButton's showTestId.
   */
  showTestIds?: boolean;
}) {
  const t = useTranslations("admin");
  const pathname = usePathname(); // locale-stripped, e.g. "/admin/users"

  return (
    <nav aria-label={t("sidebarAria")} className="space-y-7">
      {ADMIN_NAV.map((section) => (
        <div key={section.sectionKey}>
          <p className="label mb-2 px-3 text-mute-2">{t(section.sectionKey)}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              // Exact match only: "/admin" must not light up on "/admin/users".
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    {...(showTestIds
                      ? {
                          "data-testid": `admin-nav-${item.href.split("/").pop()}`,
                        }
                      : {})}
                    className={`flex min-h-11 items-center border-l-2 px-3 text-[15px] transition-colors ${
                      active
                        ? "border-ink bg-surface font-medium text-ink"
                        : "border-transparent text-mute hover:text-ink"
                    }`}
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
