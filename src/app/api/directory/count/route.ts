import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import {
  getDirectoryBaseList,
  applyDirectoryOverlay,
} from "@/lib/photographer-directory";

// Live result count for the mobile filter sheet ("Show N results"). Runs the
// exact same base query (shared unstable_cache — usually a cache hit) and
// overlay as the directory page, so the promised number matches the page that
// renders after Apply. Public data; "saved" alone needs the viewer's session.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;

  try {
    const baseList = await getDirectoryBaseList({
      type: p.get("type") ?? undefined,
      canton: p.get("canton") ?? undefined,
      verified: p.get("verified") ?? undefined,
      discipline: p.get("discipline") ?? undefined,
    });

    let savedIds: Set<string> | null = null;
    if (p.get("saved")) {
      const viewer = await getSessionUser();
      if (viewer) {
        const supabase = await createClient();
        const { data: favs } = await supabase
          .from("favorites")
          .select("photographer_id")
          .eq("user_id", viewer.id);
        savedIds = new Set((favs ?? []).map((f) => f.photographer_id));
      } else {
        savedIds = new Set();
      }
    }

    const count = applyDirectoryOverlay(baseList, {
      minRating: p.get("minRating") ? Number(p.get("minRating")) : 0,
      query: p.get("q")?.trim().toLowerCase() ?? "",
      savedIds,
    }).length;

    return NextResponse.json({ count });
  } catch {
    // The sheet degrades to a plain "Apply" label; never leak error detail.
    return NextResponse.json({ count: null }, { status: 200 });
  }
}
