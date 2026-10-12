import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Every date and time is formatted in Swiss time. Without it next-intl uses
 * the runtime's zone: UTC on the server (Vercel), the device's zone in the
 * browser, so server-rendered times were 1–2 h off and could disagree with
 * the client's.
 */
export const TIME_ZONE = "Europe/Zurich";

/** next-intl request config, as a plain function so it can be unit-tested. */
export async function resolveRequestConfig(requested: string | undefined) {
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    timeZone: TIME_ZONE,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
}
