"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import type { AdminCounts } from "@/lib/admin/counts";

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
      { href: "/admin/reports", labelKey: "tabReports", countKey: "reports" },
      {
        href: "/admin/verifications",
        labelKey: "tabVerifications",
        countKey: "verifications",
      },
      {
        href: "/admin/disputes",
        labelKey: "tabDisputes",
        countKey: "disputes",
      },
    ],
  },
  {
    sectionKey: "sectionSystem",
    items: [
      { href: "/admin/audit", labelKey: "tabAudit" },
      { href: "/admin/email", labelKey: "tabEmail", countKey: "email" },
    ],
  },
] as const;

export function AdminSidebar({ counts }: { counts: AdminCounts }) {
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
                    {"countKey" in item && counts[item.countKey] > 0 && (
                      <span
                        data-testid={`admin-nav-dot-${item.countKey}`}
                        aria-label={String(counts[item.countKey])}
                        className="ml-auto h-1.5 w-1.5 shrink-0 bg-accent"
                      />
                    )}
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
