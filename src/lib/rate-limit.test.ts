import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests exercise the in-process sliding-window limiter (the default when
// no Upstash env is set) and the Upstash backend's allow/deny/fail-open
// behaviour. Rate limiting is an abuse-protection control, so its edge
// behaviour — especially "fail open on outage" — is worth pinning down.

describe("rateLimit — in-process sliding window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit, then denies the next call", async () => {
    const { rateLimit } = await import("./rate-limit");
    const key = "test:allow-then-deny";

    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    expect(await rateLimit(key, 3, 60_000)).toBe(true);
    // 4th within the window is over the limit.
    expect(await rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("keeps separate buckets per key independent", async () => {
    const { rateLimit } = await import("./rate-limit");

    expect(await rateLimit("test:user-a", 1, 60_000)).toBe(true);
    expect(await rateLimit("test:user-a", 1, 60_000)).toBe(false);
    // A different key is unaffected by user-a hitting its limit.
    expect(await rateLimit("test:user-b", 1, 60_000)).toBe(true);
  });

  it("allows again once old hits slide out of the window", async () => {
    const { rateLimit } = await import("./rate-limit");
    const key = "test:window-resets";

    expect(await rateLimit(key, 1, 60_000)).toBe(true);
    expect(await rateLimit(key, 1, 60_000)).toBe(false);

    // Advance past the window; the earlier hit no longer counts.
    vi.advanceTimersByTime(60_001);
    expect(await rateLimit(key, 1, 60_000)).toBe(true);
  });

  it("still counts a hit one ms before the window edge", async () => {
    const { rateLimit } = await import("./rate-limit");
    const key = "test:window-boundary";

    expect(await rateLimit(key, 1, 60_000)).toBe(true);
    // cutoff is `now - windowMs` and the filter keeps `t > cutoff`, so a hit is
    // only dropped once the full window has elapsed. One ms short still counts.
    vi.advanceTimersByTime(59_999);
    expect(await rateLimit(key, 1, 60_000)).toBe(false);
  });
});

describe("rateLimit — Upstash backend", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadWithUpstash() {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    return import("./rate-limit");
  }

  it("allows when the Lua script returns 1", async () => {
    const { rateLimit } = await loadWithUpstash();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: 1 }), { status: 200 })
    );

    expect(await rateLimit("k", 5, 1000)).toBe(true);
  });

  it("denies when the Lua script returns 0", async () => {
    const { rateLimit } = await loadWithUpstash();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ result: 0 }), { status: 200 })
    );

    expect(await rateLimit("k", 5, 1000)).toBe(false);
  });

  it("fails open (allows) when Upstash is unreachable", async () => {
    const { rateLimit } = await loadWithUpstash();
    // Silence the captureError console output for a clean test run.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    expect(await rateLimit("k", 1, 1000)).toBe(true);
  });

  it("fails open when Upstash returns a non-OK status", async () => {
    const { rateLimit } = await loadWithUpstash();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 })
    );

    expect(await rateLimit("k", 1, 1000)).toBe(true);
  });
});
