"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";

export function AdminDrawer() {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation — the drawer would otherwise stay over the new page.
  // Adjusted during render (React's recommended pattern) rather than in an
  // effect, which would call setState synchronously in the effect body.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Close on Escape, the expected affordance for a slide-over.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        data-testid="admin-drawer-open"
        aria-expanded={open}
        aria-label={t("sidebarAria")}
        onClick={() => setOpen(true)}
        className="press flex h-11 w-11 items-center justify-center border border-line text-ink"
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-backdrop"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto border-r border-line bg-paper px-4 py-8">
            <AdminSidebar />
          </div>
        </div>
      )}
    </div>
  );
}
