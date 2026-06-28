"use client";

import type { ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * Responsive master–detail shell for Messages. On desktop it's a two-pane inbox
 * (conversation sidebar + active thread). On mobile it's single-pane: the list
 * on /messages, the thread on /messages/[id] — toggled by the current path.
 */
export function MessagesShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isIndex = pathname === "/messages";

  return (
    <div className="lg:grid lg:h-[calc(100vh-9rem)] lg:grid-cols-[340px_1fr] lg:border lg:border-line">
      <aside
        className={`${isIndex ? "block" : "hidden"} lg:block lg:h-full lg:overflow-hidden lg:border-r lg:border-line`}
      >
        {sidebar}
      </aside>
      <section
        className={`${isIndex ? "hidden" : "block"} lg:block lg:h-full lg:overflow-hidden`}
      >
        {children}
      </section>
    </div>
  );
}
