import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

// Fast, unauthenticated health check for uptime monitors / load balancers.
// Never cached. Does one cheap connectivity check (a HEAD count against a
// small public table) so a broken Supabase connection surfaces as a 503
// instead of the app silently failing every request — but no query body, no
// row data, and no internal error detail is ever returned in the response.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createPublicClient();
    const { error } = await supabase
      .from("photographer_details")
      .select("profile_id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return NextResponse.json({ status: "degraded" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
