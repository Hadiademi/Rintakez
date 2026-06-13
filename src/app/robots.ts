import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/de/home",
        "/fr/home",
        "/en/home",
        "/de/my-shoots",
        "/fr/my-shoots",
        "/en/my-shoots",
        "/de/my-bids",
        "/fr/my-bids",
        "/en/my-bids",
        "/de/onboarding",
        "/fr/onboarding",
        "/en/onboarding",
        "/de/settings",
        "/fr/settings",
        "/en/settings",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
