"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";

const TABS = [
  { href: "/admin", key: "tabDashboard" },
  { href: "/admin/users", key: "tabUsers" },
  { href: "/admin/verifications", key: "tabVerifications" },
  { href: "/admin/reports", key: "tabReports" },
  { href: "/admin/disputes", key: "tabDisputes" },
  { href: "/admin/audit", key: "tabAudit" },
  { href: "/admin/email", key: "tabEmail" },
] as const;

export function AdminTabs() {
  const t = useTranslations("admin");
  const pathname = usePathname(); // locale-stripped, e.g. "/admin/users"

  return (
    <nav className="flex flex-wrap gap-x-5 gap-y-2 border-b border-line pb-px">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 pb-3 text-sm transition-colors ${
              active
                ? "border-ink font-medium text-ink"
                : "border-transparent text-mute hover:text-ink"
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
