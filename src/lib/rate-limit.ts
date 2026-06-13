import "server-only";

// Lightweight in-process sliding-window rate limiter. It throttles bursts on a
// single server instance with zero dependencies. For strict, cross-instance
// limits in a serverless deployment, back this with Upstash Redis / Vercel KV —
// the call sites stay the same.

const hits = new Map<string, number[]>();

/**
 * Returns true if the action is allowed, false if the limit is exceeded.
 * @param key      unique bucket (e.g. `bid:<userId>`)
 * @param limit    max actions allowed within the window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
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
