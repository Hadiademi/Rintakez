import { NextResponse } from "next/server";
import { drainEmailOutbox } from "@/lib/email";
import { runLifecycleScans } from "@/lib/lifecycle";
import { captureError } from "@/lib/observability";

// Scheduled maintenance, invoked by Vercel Cron (see vercel.json). Vercel adds
// `Authorization: Bearer <CRON_SECRET>` to cron requests when CRON_SECRET is set;
// we require it so the endpoint cannot be triggered by anyone. Drains the
// durable email outbox, then runs the lifecycle-email scans (onboarding
// reminder, zero-bid rescue, review request, basic-tier shoot-match digest —
// see src/lib/lifecycle.ts) so their enqueued rows are picked up by the very
// next drain. Stale open shoots
// are handled at query/RLS level (past-date shoots are hidden from browse and
// cannot receive bids).

export const dynamic = "force-dynamic";
// Drains up to ~25 emails sequentially (Resend ~8s each worst case → ~200s
// possible). Make the ceiling explicit so a smaller platform default can't
// truncate the drain mid-batch; 300s is the current Vercel default ceiling.
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const email = await drainEmailOutbox();
    const lifecycle = await runLifecycleScans();
    return NextResponse.json({ ok: true, email, lifecycle });
  } catch (err) {
    captureError(err, { scope: "cron.process" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
