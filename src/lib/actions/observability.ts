"use server";

import { captureError } from "@/lib/observability";

/**
 * Funnel a client-side error to the server observability seam. Client code
 * cannot reach ERROR_WEBHOOK_URL (a server-only env), so without this hop every
 * browser error was logged to the user's console and lost. Error boundaries and
 * the global window listener call this so client errors land in the same sink as
 * server errors.
 */
export async function reportClientError(payload: {
  message: string;
  stack?: string;
  digest?: string;
  source?: string;
  url?: string;
}): Promise<void> {
  const err = new Error(payload.message || "client error");
  if (payload.stack) err.stack = payload.stack;
  captureError(err, {
    origin: "client",
    source: payload.source,
    digest: payload.digest,
    url: payload.url,
  });
}
