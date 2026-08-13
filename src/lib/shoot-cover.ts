// Real cover images for shoot cards.
//
// Clients upload reference images with their brief (private `shoot-refs`
// bucket). Cards used to show only the decorative per-type stock art, which
// reads as "someone else's photo" next to the owner's own shoot. Cards now
// prefer the shoot's own first uploaded image; the stock art stays as the
// fallback for shoots without uploads.
//
// Visibility is the existing M1 RLS, unchanged: refs of OPEN shoots are
// readable by anyone (that is what lets the public landing feature the latest
// shoot's real photo); otherwise only the owner or the accepted photographer.
// Signing happens with the CALLER's client, so a viewer who may not see a
// shoot's refs simply gets no map entry and the card falls back to stock —
// no policy change, no leak.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ShootImageRow = {
  shoot_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
};

/** Pure: first image path per shoot (lowest sort_order, ties → oldest). */
export function firstPathPerShoot(rows: ShootImageRow[]): Map<string, string> {
  const best = new Map<string, ShootImageRow>();
  for (const r of rows) {
    const cur = best.get(r.shoot_id);
    if (
      !cur ||
      r.sort_order < cur.sort_order ||
      (r.sort_order === cur.sort_order && r.created_at < cur.created_at)
    ) {
      best.set(r.shoot_id, r);
    }
  }
  const out = new Map<string, string>();
  for (const [id, r] of best) out.set(id, r.storage_path);
  return out;
}

/**
 * Signed cover URL (1h) per shoot that has an uploaded image the viewer is
 * allowed to see. Shoots without one simply have no entry — callers fall back
 * to `shootImage()`. Never throws: cover art must not take a page down.
 */
export async function getShootCoverUrls(
  supabase: SupabaseClient,
  shootIds: string[]
): Promise<Map<string, string>> {
  const covers = new Map<string, string>();
  if (shootIds.length === 0) return covers;

  try {
    const { data: rows } = await supabase
      .from("shoot_images")
      .select("shoot_id, storage_path, sort_order, created_at")
      .in("shoot_id", shootIds);
    const first = firstPathPerShoot((rows as ShootImageRow[]) ?? []);
    if (first.size === 0) return covers;

    const paths = [...first.values()];
    const { data: signed } = await supabase.storage
      .from("shoot-refs")
      .createSignedUrls(paths, 3600);
    const byPath = new Map(
      (signed ?? [])
        .filter((s) => !!s.signedUrl)
        .map((s) => [s.path, s.signedUrl])
    );
    for (const [id, path] of first) {
      const url = byPath.get(path);
      if (url) covers.set(id, url);
    }
  } catch {
    // Fall through to the stock covers.
  }
  return covers;
}
