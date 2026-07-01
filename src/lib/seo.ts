import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type SeoHref = string | { pathname: string; query?: Record<string, string | string[]> };

/**
 * Builds path-aware `alternates` (canonical + per-locale hreflang) for a
 * given in-app href, so a page like `/photographers` advertises its de/fr/en
 * alternates as the SAME page in each locale — never the locale homepages.
 *
 * `href` is the locale-agnostic pathname as understood by next-intl's
 * navigation APIs, e.g. `/photographers` or `/shoots/${id}`.
 */
export function buildAlternates(
  locale: string,
  href: SeoHref
): Metadata["alternates"] {
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, getPathname({ locale: l, href })])
  );

  return {
    canonical: getPathname({ locale, href }),
    languages,
  };
}
