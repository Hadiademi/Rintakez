import Script from "next/script";

/**
 * Privacy-first analytics (Plausible — cookieless, GDPR/revFADP-friendly).
 * Renders nothing unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, so it is a no-op
 * locally and inert until configured for production.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  const src =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ??
    "https://plausible.io/js/script.js";

  return (
    <Script
      defer
      data-domain={domain}
      src={src}
      strategy="afterInteractive"
    />
  );
}
