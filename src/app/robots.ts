import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/*/home",
        "/*/my-shoots",
        "/*/my-bids",
        "/*/messages",
        "/*/profile",
        "/*/onboarding",
        "/*/settings",
        "/*/shoots/new",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
