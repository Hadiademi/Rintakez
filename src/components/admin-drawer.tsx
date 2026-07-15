"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";
import type { AdminCounts } from "@/lib/admin/counts";

const PANEL_ID = "admin-drawer";

export function AdminDrawer({ counts }: { counts: AdminCounts }) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation — the drawer would otherwise stay over the new page.
  // Adjusted during render (React's recommended pattern) rather than in an
  // effect, which would call setState synchronously in the effect body.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Close and hand focus back to the hamburger. Without this the focused
  // element (a nav link, or nothing) unmounts and focus falls to <body>, so
  // the next Tab restarts from the top of the document instead of resuming
  // at the control that opened the drawer.
  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Close on Escape, the expected affordance for a slide-over.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAndRestoreFocus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeAndRestoreFocus]);

  // Lock body scroll while open, same approach as ImageLightbox. Scoped to
  // `open` rather than mount/unmount of AdminDrawer (which never unmounts,
  // since it lives in the admin layout) so the cleanup below — which reverts
  // the lock — runs on every path that closes the drawer, not only the
  // explicit close handlers.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the panel when it opens, as a real dialog should.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        data-testid="admin-drawer-open"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={t("openNav")}
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
          {/* Backdrop click-to-dismiss is a supplementary convenience; full
              keyboard equivalents already exist (Escape via the document
              listener above, and the focusable nav links inside the panel),
              so no keyboard user loses functionality. */}
          <button
            type="button"
            aria-label={tCommon("close")}
            onClick={closeAndRestoreFocus}
            className="absolute inset-0 bg-ink/40"
          />
          {/* onClick here checks for nav link clicks via closest("a"): it
              closes the drawer only when a link is clicked, including a tap on
              the link for the page already open (whose pathname doesn't
              change, so the render-time guard above never fires). Clicks on
              non-link elements (padding, labels, gaps) do not dismiss. Same
              keyboard-equivalents rationale as the backdrop button above. */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <div
            ref={panelRef}
            id={PANEL_ID}
            data-testid="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("sidebarAria")}
            tabIndex={-1}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) closeAndRestoreFocus();
            }}
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto border-r border-line bg-paper px-4 py-8"
          >
            <AdminSidebar counts={counts} />
          </div>
        </div>
      )}
    </div>
  );
}
