"use client";

import { Link, usePathname } from "@/i18n/navigation";

type NavLink = { href: string; label: string };

/** Desktop primary nav links with an active underline, matching the design. */
export function NavLinks({ links }: { links: readonly NavLink[] }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-7">
      {links.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`relative py-1 text-sm tracking-tight transition-colors ${
              active ? "text-ink" : "text-mute hover:text-ink"
            }`}
          >
            {label}
            {active && (
              <span className="absolute -bottom-[17px] left-0 h-px w-full bg-ink" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
