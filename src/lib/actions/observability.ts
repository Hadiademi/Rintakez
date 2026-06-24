"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { captureError } from "@/lib/observability";
import { getSessionUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

// Bounded payload — caps each field so a single report can't ship an unbounded
// blob to the error sink, and drops anything malformed.
const payloadSchema = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(4000).optional(),
  digest: z.string().max(200).optional(),
  source: z.string().max(200).optional(),
  url: z.string().max(1000).optional(),
});

/**
 * Funnel a client-side error to the server observability seam. Client code
 * cannot reach ERROR_WEBHOOK_URL (a server-only env), so without this hop every
 * browser error was logged to the user's console and lost. Error boundaries and
 * the global window listener call this so client errors land in the same sink as
 * server errors.
 *
 * Hardened: the endpoint is reachable by anonymous visitors (errors happen on
 * public pages too), so it validates + caps the payload and rate-limits per
 * identity (authenticated user, else client IP) to stop it being used to spam
 * the error webhook. Failures are swallowed — reporting must never throw.
 */
export async function reportClientError(payload: unknown): Promise<void> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return;

  // Identity for the rate-limit bucket: the user if signed in, else best-effort
  // client IP from proxy headers.
  let id: string;
  const user = await getSessionUser();
  if (user) {
    id = `u:${user.id}`;
  } else {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "anon";
    id = `ip:${ip}`;
  }

  // 30 reports / 5 min per identity is plenty for genuine error bursts.
  if (!(await rateLimit(`clienterr:${id}`, 30, 300_000))) return;

  const { message, stack, digest, source, url } = parsed.data;
  const err = new Error(message);
  if (stack) err.stack = stack;
  captureError(err, { origin: "client", source, digest, url });
}
