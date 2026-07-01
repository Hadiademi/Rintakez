import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/observability";
import { getActiveCantonTypeCombos } from "@/lib/photographer-landing-combos";

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
  // Programmatic canton x shoot-type landing pages — only combos that
  // currently have >=1 matching, non-suspended photographer are worth an
  // index entry (26 cantons x 7 types = 182 possible combos; emitting all of
  // them regardless of listings would be exactly the low-value sitemap bloat
  // we want to avoid). Shared with the directory page's "popular searches"
  // block so both derive the same set of "real" combos from one query.
  try {
    const combos = await getActiveCantonTypeCombos();
    for (const { canton, type } of combos) {
      for (const locale of routing.locales) {
        entries.push({
          url: `${SITE_URL}/${locale}/photographers/${canton}/${type}`,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  } catch (err) {
    // DB unreachable at build time — static entries still emitted, but record it.
    captureError(err, { scope: "sitemap.landingPages" });
  }
  return entries;
}
