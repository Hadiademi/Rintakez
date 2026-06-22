import { NextResponse } from "next/server";
import { drainEmailOutbox } from "@/lib/email";
import { captureError } from "@/lib/observability";

// Scheduled maintenance, invoked by Vercel Cron (see vercel.json). Vercel adds
// `Authorization: Bearer <CRON_SECRET>` to cron requests when CRON_SECRET is set;
// we require it so the endpoint cannot be triggered by anyone. Currently it
// drains the durable email outbox; stale open shoots are handled at query/RLS
// level (past-date shoots are hidden from browse and cannot receive bids).

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ok: true, email });
  } catch (err) {
    captureError(err, { scope: "cron.process" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
