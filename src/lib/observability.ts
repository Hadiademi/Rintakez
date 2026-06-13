// Lightweight, dependency-free error-reporting seam. Always logs structured
// JSON; when ERROR_WEBHOOK_URL is set it also forwards the event (a Sentry/
// Logflare/Slack-style sink). Swap this for @sentry/nextjs later by routing
// captureError() into Sentry.captureException — the call sites stay the same.

type ErrorContext = Record<string, unknown>;

export function captureError(error: unknown, context?: ErrorContext): void {
  const payload = {
    level: "error" as const,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    at: new Date().toISOString(),
  };

  // Always visible in server logs / browser console.
  console.error("[captureError]", JSON.stringify(payload));

  const sink = process.env.ERROR_WEBHOOK_URL;
  if (sink) {
    // Fire-and-forget; never let reporting throw into the caller.
    void fetch(sink, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}
