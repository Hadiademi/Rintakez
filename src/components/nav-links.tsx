"use client";

import { Link, usePathname } from "@/i18n/navigation";

type NavLink = { href: string; label: string };

/** Desktop primary nav links with an active underline, matching the design. */
export function NavLinks({
  links,
  messagesUnread = 0,
}: {
  links: readonly NavLink[];
  messagesUnread?: number;
}) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-7">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const badge = href === "/messages" && messagesUnread > 0;
        return (
          <Link
            key={href}
            href={href}
            className={`relative whitespace-nowrap py-1 text-sm tracking-tight transition-colors ${
              active ? "text-ink" : "text-mute hover:text-ink"
            }`}
          >
            {label}
            {badge && (
              <span
                data-testid="nav-messages-badge"
                className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-paper align-middle"
              >
                {messagesUnread > 9 ? "9+" : messagesUnread}
              </span>
            )}
            {active && (
              <span className="absolute -bottom-[17px] left-0 h-px w-full bg-ink" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
