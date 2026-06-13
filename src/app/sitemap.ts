import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "",
    "/login",
    "/register",
    "/impressum",
    "/datenschutz",
    "/agb",
  ];
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    for (const p of staticPaths) {
      entries.push({
        url: `${SITE_URL}/${locale}${p}`,
        changeFrequency: "weekly",
        priority: p === "" ? 1 : 0.5,
      });
    }
  }
  // Public photographer profiles
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "photographer");
    for (const row of data ?? []) {
      for (const locale of routing.locales) {
        entries.push({
          url: `${SITE_URL}/${locale}/photographers/${row.id}`,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // DB unreachable at build time — static entries still emitted
  }
  return entries;
}
