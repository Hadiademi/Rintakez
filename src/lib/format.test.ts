import { describe, expect, it } from "vitest";
import { formatCHF, formatCHFRange, formatSwissDate, formatClockTime, formatMessageTime, zurichDayKey } from "./format";

describe("formatCHF", () => {
  it("formats with apostrophe thousands separator", () => {
    expect(formatCHF(3200)).toBe("CHF 3'200");
  });
  it("handles amounts under 1000 without separator", () => {
    expect(formatCHF(950)).toBe("CHF 950");
  });
  it("handles millions", () => {
    expect(formatCHF(1250000)).toBe("CHF 1'250'000");
  });
});

describe("formatCHFRange", () => {
  it("formats a budget range with en dash", () => {
    expect(formatCHFRange(3200, 4500)).toBe("CHF 3'200 – 4'500");
  });
});

describe("formatSwissDate", () => {
  it("formats ISO date as dd.MM.yyyy", () => {
    expect(formatSwissDate("2026-08-14")).toBe("14.08.2026");
  });
});

// Times are shown in Swiss time on the server (Vercel runs in UTC) and in
// the browser alike: otherwise server-rendered times were 1–2 h off and the
// client re-rendered different values. Run with TZ=UTC to see the old bug.
describe("Swiss-time message and notification times", () => {
  it("shows the Zurich clock time, in winter and in summer", () => {
    expect(formatClockTime("2026-01-15T11:05:00Z")).toBe("12:05"); // CET
    expect(formatClockTime("2026-07-15T11:05:00Z")).toBe("13:05"); // CEST
  });

  it("uses the Zurich calendar day for 'today' and day separators", () => {
    // 22:30 UTC on the 12th is 00:30 on the 13th in Zurich.
    const now = new Date("2026-10-13T08:00:00Z");
    expect(formatMessageTime("2026-10-12T22:30:00Z", now)).toBe("00:30");
    expect(formatMessageTime("2026-10-12T20:30:00Z", now)).toBe("12.10.");
    expect(formatMessageTime("2025-12-31T23:30:00Z", now)).toBe("01.01.");
    expect(formatMessageTime("2025-12-31T22:30:00Z", now)).toBe("31.12.25");
    expect(zurichDayKey("2026-10-12T22:30:00Z")).toBe("2026-10-13");
    expect(zurichDayKey("2026-10-12T21:59:00Z")).toBe("2026-10-12");
  });
});
