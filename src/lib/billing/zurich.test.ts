import { describe, expect, it } from "vitest";
import { monthStartZurich, zurichDateString, zurichHour } from "./zurich";

describe("monthStartZurich", () => {
  it("Jan 1: CET (UTC+1) — Zurich midnight is UTC 23:00 the previous day", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(monthStartZurich(now).toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });

  it("Apr 1: CEST (UTC+2) — Zurich midnight is UTC 22:00 the previous day", () => {
    const now = new Date("2026-04-15T12:00:00Z");
    expect(monthStartZurich(now).toISOString()).toBe("2026-03-31T22:00:00.000Z");
  });

  it("Nov 1: CET (UTC+1) again after the October DST fallback", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(monthStartZurich(now).toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("Dec 31 rolls forward into the January month start", () => {
    const now = new Date("2026-12-31T23:30:00Z");
    // Dec 31 23:30 UTC = Jan 1 00:30 Zurich (CET, +1h) — already in January.
    expect(monthStartZurich(now).toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
});

describe("zurichHour", () => {
  it("returns the Zurich local hour (CET, UTC+1) in January", () => {
    expect(zurichHour(new Date("2026-01-15T10:00:00Z"))).toBe(11);
  });

  it("returns the Zurich local hour (CEST, UTC+2) in July", () => {
    expect(zurichHour(new Date("2026-07-15T10:00:00Z"))).toBe(12);
  });

  it("is consistent across the spring-forward DST switch", () => {
    // Last Sunday of March 2026 is Mar 29; 00:30 UTC is before the 01:00 UTC
    // switch instant, so still CET (+1h) -> 01:30 local.
    expect(zurichHour(new Date("2026-03-29T00:30:00Z"))).toBe(1);
    // 02:00 UTC is after the switch -> CEST (+2h) -> 04:00 local.
    expect(zurichHour(new Date("2026-03-29T02:00:00Z"))).toBe(4);
  });
});

describe("zurichDateString", () => {
  it("formats a plain date as YYYY-MM-DD", () => {
    expect(zurichDateString(new Date("2026-06-15T10:00:00Z"))).toBe("2026-06-15");
  });

  it("rolls the date forward across midnight Zurich (CET, +1h)", () => {
    // 23:30 UTC on Jan 15 is 00:30 local on Jan 16 (CET).
    expect(zurichDateString(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });

  it("handles the Dec 31 -> Jan 1 year rollover", () => {
    expect(zurichDateString(new Date("2025-12-31T23:30:00Z"))).toBe("2026-01-01");
  });
});
