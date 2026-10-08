import { routing } from "@/i18n/routing";

/**
 * Shared open-redirect guard for the two auth routes that take a destination
 * from the query string (/auth/callback and /auth/confirm).
 *
 * Both routes finish by redirecting somewhere the CALLER named, which is the
 * classic open-redirect shape: `new URL(raw, origin)` lets an ABSOLUTE `raw`
 * win over the base, so `?next=https://evil.example` walks straight past a
 * naive implementation. /auth/confirm already guarded this inline;
 * /auth/callback did not. Rather than copy the check a second time (a
 * convention that the third route would forget), the rule lives here once and
 * both routes call it — the guard cannot be skipped by accident any more.
 *
 * Kept free of `next/server` so it is a plain pure function: directly unit
 * testable without faking a request, which is why the hostile cases below are
 * cheap to keep covered.
 */

/** Locales this app serves, from the single next-intl source of truth. */
const LOCALES: readonly string[] = routing.locales;

/**
 * Narrow an untrusted `?locale=` value to a locale we actually serve.
 *
 * Unvalidated, this value was interpolated straight into redirect paths
 * (`/${locale}/login`), so a crafted value produced nonsense URLs and, worse,
 * made the path structure attacker-influenced. Anything unrecognised falls
 * back to the app's default locale.
 */
export function safeLocale(raw: string | null | undefined): string {
  return raw && LOCALES.includes(raw) ? raw : routing.defaultLocale;
}

/**
 * Resolve an untrusted redirect destination to a URL that is guaranteed to
 * stay on `origin`.
 *
 * Returns the fallback whenever `raw` is absent, unparseable, or resolves off
 * this origin. Three hostile shapes are all handled by the single origin
 * comparison rather than by pattern-matching, which is what makes this
 * reliable:
 *
 *   - absolute        `https://evil.example`  -> its own origin, rejected
 *   - protocol-relative `//evil.example`      -> resolves to evil's origin, rejected
 *   - scheme          `javascript:alert(1)`   -> origin "null", rejected
 *
 * Relative paths (`/de/home`, `messages/1`) resolve against `origin` and are
 * kept, including their query and hash.
 */
export function safeRedirectTarget(
  raw: string | null | undefined,
  origin: string,
  fallback: string
): URL {
  const fallbackUrl = new URL(fallback, origin);
  if (!raw) return fallbackUrl;

  try {
    const target = new URL(raw, origin);
    return target.origin === fallbackUrl.origin ? target : fallbackUrl;
  } catch {
    // Unparseable even against a base — treat exactly like an off-origin value.
    return fallbackUrl;
  }
}
