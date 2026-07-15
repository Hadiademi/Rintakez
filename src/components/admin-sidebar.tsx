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

export function AdminSidebar() {
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
                    data-testid={`admin-nav-${item.href.split("/").pop()}`}
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
