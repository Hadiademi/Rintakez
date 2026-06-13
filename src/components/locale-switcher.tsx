"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="relative inline-flex items-center">
      <select
        value={locale}
        onChange={(e) =>
          router.replace(pathname, { locale: e.target.value as typeof locale })
        }
        aria-label="Language"
        data-testid="locale-switcher"
        className="label press cursor-pointer appearance-none border border-line bg-paper py-1.5 pl-2.5 pr-7 text-ink transition-colors hover:border-ink focus:border-ink focus:outline-none"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {l.toUpperCase()}
          </option>
        ))}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className="pointer-events-none absolute right-2 text-mute"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
