"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="flex items-center border border-line">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          aria-pressed={l === locale}
          className={`label press px-2.5 py-1.5 transition-colors ${
            l === locale ? "bg-ink text-paper" : "text-mute-2 hover:text-ink"
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
