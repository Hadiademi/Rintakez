"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="flex gap-3">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={`label press ${l === locale ? "text-ink" : "text-mute-2"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
