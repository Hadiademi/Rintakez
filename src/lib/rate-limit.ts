import "server-only";
import { captureError } from "@/lib/observability";

// Sliding-window rate limiter with two backends:
//
//  • Distributed (production): Upstash Redis over its REST API when
//    UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set. A single Lua
//    script does the whole check atomically, so the limit holds across every
//    serverless instance — not just the one that happens to serve the request.
//
//  • In-process (dev / single instance): a plain Map. Zero dependencies, but it
//    only throttles bursts on one process and resets on cold start, so it must
//    not be relied on in a multi-instance deployment.
//
// `rateLimit` is async and returns true when the action is allowed.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ── in-process fallback ──────────────────────────────────────────────
const hits = new Map<string, number[]>();

function rateLimitInProcess(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      const live = v.filter((t) => t > cutoff);
      if (live.length === 0) hits.delete(k);
      else hits.set(k, live);
    }
  }

  return true;
}

// ── distributed backend (Upstash Redis REST) ────────────────────────
// Atomic sliding-window log: drop entries older than the window, count what's
// left, and only add the new entry if we're under the limit. Returns 1 (allow)
// or 0 (deny).
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return 1
`;

async function rateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const member = `${now}-${crypto.randomUUID()}`;
  const body = JSON.stringify([
    "EVAL",
    SLIDING_WINDOW_LUA,
    "1",
    `rl:${key}`,
    String(now),
    String(windowMs),
    String(limit),
    member,
  ]);

  const res = await fetch(UPSTASH_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = (await res.json()) as { result?: number; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result === 1;
}

/**
 * Returns true if the action is allowed, false if the limit is exceeded.
 * @param key      unique bucket (e.g. `bid:<userId>`)
 * @param limit    max actions allowed within the window
 * @param windowMs window length in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return rateLimitInProcess(key, limit, windowMs);
  }

  try {
    return await rateLimitUpstash(key, limit, windowMs);
  } catch (err) {
    // Fail open: an Upstash outage must not lock legitimate users out. Surface
    // it to observability so the degraded protection is visible.
    captureError(err, { scope: "rate-limit.upstash", key });
    return true;
  }
}
