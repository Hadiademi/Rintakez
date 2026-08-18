// Lightweight, dependency-free error-reporting seam. Always logs structured
// JSON; when ERROR_WEBHOOK_URL is set it also forwards the event to that sink.
// The sink body is shaped to the webhook's dialect (Discord wants {content},
// Slack wants {text}; anything else gets the raw JSON payload) — a generic
// JSON POST to a Discord webhook is rejected with 400, so without this the
// alert would be silently lost exactly when it matters. Swap this for
// @sentry/nextjs later by routing captureError() into Sentry.captureException —
// the call sites stay the same.

type ErrorContext = Record<string, unknown>;

type ErrorPayload = {
  level: "error";
  message: string;
  stack?: string;
  context?: ErrorContext;
  env?: string;
  at: string;
};

// Discord hard-caps `content` at 2000 chars; stay under it with room to spare.
const DISCORD_CONTENT_MAX = 1900;

/** Shape the webhook body for the sink's dialect. Exported for unit tests. */
export function formatSinkBody(sinkUrl: string, payload: ErrorPayload): string {
  let host = "";
  try {
    host = new URL(sinkUrl).hostname;
  } catch {
    // Malformed sink URL — fall through to raw JSON; the fetch will fail and
    // be swallowed, but the console log above always has the event.
  }

  if (host === "discord.com" || host === "discordapp.com") {
    const lines = [
      `🔴 **framly ${payload.env ?? "?"}** — ${payload.message}`,
      payload.context ? "```json\n" + JSON.stringify(payload.context) + "\n```" : "",
      payload.stack ? "```\n" + payload.stack.split("\n").slice(0, 6).join("\n") + "\n```" : "",
    ].filter(Boolean);
    return JSON.stringify({
      content: lines.join("\n").slice(0, DISCORD_CONTENT_MAX),
    });
  }

  if (host === "hooks.slack.com") {
    const text = [
      `:red_circle: framly ${payload.env ?? "?"} — ${payload.message}`,
      payload.context ? "```" + JSON.stringify(payload.context) + "```" : "",
      payload.stack ? "```" + payload.stack.split("\n").slice(0, 6).join("\n") + "```" : "",
    ]
      .filter(Boolean)
      .join("\n");
    return JSON.stringify({ text });
  }

  return JSON.stringify(payload);
}

// Error-storm throttle: at most MAX_POSTS webhook posts per window per server
// instance, so a crash loop can't flood (and get the webhook rate-banned by)
// the channel. Dropped events still hit the console log — nothing is lost from
// the server logs, only the pings are capped. In-memory on purpose: per
// instance is exactly the granularity that protects the sink.
const THROTTLE_WINDOW_MS = 60_000;
const MAX_POSTS_PER_WINDOW = 5;
let windowStart = 0;
let postsInWindow = 0;

/** True when this event may post to the sink. Exported for unit tests. */
export function sinkThrottleAllow(now: number): boolean {
  if (now - windowStart >= THROTTLE_WINDOW_MS) {
    windowStart = now;
    postsInWindow = 0;
  }
  postsInWindow += 1;
  return postsInWindow <= MAX_POSTS_PER_WINDOW;
}

/** Non-Error throwables (Supabase PostgrestError, plain objects) stringify to
 * the useless "[object Object]" — serialize them instead so the sink shows
 * the actual code/message/details. Circular objects fall back to String(). */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

export function captureError(error: unknown, context?: ErrorContext): void {
  const payload: ErrorPayload = {
    level: "error",
    message: describeError(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    at: new Date().toISOString(),
  };

  // Always visible in server logs / browser console.
  console.error("[captureError]", JSON.stringify(payload));

  const sink = process.env.ERROR_WEBHOOK_URL;
  if (sink && sinkThrottleAllow(Date.now())) {
    // Fire-and-forget; never let reporting throw into the caller.
    void fetch(sink, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: formatSinkBody(sink, payload),
    }).catch(() => {});
  }
}
