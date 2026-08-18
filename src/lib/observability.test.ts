import { describe, expect, it } from "vitest";
import { captureError, formatSinkBody, sinkThrottleAllow } from "./observability";

const payload = {
  level: "error" as const,
  message: "boom",
  stack: "Error: boom\n  at a\n  at b\n  at c\n  at d\n  at e\n  at f\n  at g",
  context: { scope: "test" },
  env: "production",
  at: "2026-08-16T00:00:00.000Z",
};

describe("formatSinkBody", () => {
  it("shapes a Discord webhook body as {content} with message, context and a trimmed stack", () => {
    const body = JSON.parse(
      formatSinkBody("https://discord.com/api/webhooks/123/abc", payload)
    );
    expect(Object.keys(body)).toEqual(["content"]);
    expect(body.content).toContain("framly production");
    expect(body.content).toContain("boom");
    expect(body.content).toContain('"scope":"test"');
    // Stack trimmed to 6 lines: "at f" (line 6) is the last one kept.
    expect(body.content).toContain("at e");
    expect(body.content).not.toContain("at g");
  });

  it("caps Discord content under the 2000-char limit", () => {
    const body = JSON.parse(
      formatSinkBody("https://discord.com/api/webhooks/123/abc", {
        ...payload,
        message: "x".repeat(5000),
      })
    );
    expect(body.content.length).toBeLessThanOrEqual(1900);
  });

  it("shapes a Slack webhook body as {text}", () => {
    const body = JSON.parse(
      formatSinkBody("https://hooks.slack.com/services/T/B/x", payload)
    );
    expect(Object.keys(body)).toEqual(["text"]);
    expect(body.text).toContain("boom");
  });

  it("passes the raw payload through to generic sinks", () => {
    const body = JSON.parse(
      formatSinkBody("https://logs.example.com/ingest", payload)
    );
    expect(body.message).toBe("boom");
    expect(body.level).toBe("error");
    expect(body.at).toBe(payload.at);
  });

  it("falls back to raw JSON when the sink URL is malformed", () => {
    const body = JSON.parse(formatSinkBody("not-a-url", payload));
    expect(body.message).toBe("boom");
  });
});

describe("sinkThrottleAllow", () => {
  it("allows 5 posts per minute per instance, drops the rest, then resets", () => {
    const t0 = 10_000_000; // fresh window (far from any prior test state)
    for (let i = 0; i < 5; i++) {
      expect(sinkThrottleAllow(t0 + i)).toBe(true);
    }
    expect(sinkThrottleAllow(t0 + 5)).toBe(false);
    expect(sinkThrottleAllow(t0 + 6)).toBe(false);
    // New window → allowed again.
    expect(sinkThrottleAllow(t0 + 60_000)).toBe(true);
  });
});

describe("captureError message shaping", () => {
  it("serializes non-Error objects instead of '[object Object]'", () => {
    const logged: string[] = [];
    const orig = console.error;
    console.error = (...args: unknown[]) => { logged.push(String(args[1])); };
    try {
      // Shape of a Supabase PostgrestError — a plain object, not an Error.
      captureError({ code: "23505", message: "duplicate key" });
    } finally {
      console.error = orig;
    }
    expect(logged[0]).toContain("23505");
    expect(logged[0]).toContain("duplicate key");
    expect(logged[0]).not.toContain("[object Object]");
  });
});
