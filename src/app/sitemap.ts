import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/observability";

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
  // Directory pages (photographers + shoots browse) — high-value discovery
  // entry points, refreshed often as listings change.
  for (const locale of routing.locales) {
    for (const p of ["/photographers", "/shoots"]) {
      entries.push({
        url: `${SITE_URL}/${locale}${p}`,
        changeFrequency: "daily",
        priority: 0.7,
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
  } catch (err) {
    // DB unreachable at build time — static entries still emitted, but record it.
    captureError(err, { scope: "sitemap.photographers" });
  }
  // Open shoot detail pages — not suspended, still open for bids.
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("shoots")
      .select("id, created_at")
      .eq("status", "open")
      .eq("is_suspended", false);
    for (const row of data ?? []) {
      for (const locale of routing.locales) {
        entries.push({
          url: `${SITE_URL}/${locale}/shoots/${row.id}`,
          lastModified: row.created_at ? new Date(row.created_at) : undefined,
          changeFrequency: "daily",
          priority: 0.5,
        });
      }
    }
  } catch (err) {
    // DB unreachable at build time — static entries still emitted, but record it.
    captureError(err, { scope: "sitemap.shoots" });
  }
  return entries;
}
