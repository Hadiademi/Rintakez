import { describe, expect, it } from "vitest";
import { addMonthsUtc } from "./dates";

describe("addMonthsUtc", () => {
  it("clamps Jan 31 + 1 month to Feb 28 (non-leap year)", () => {
    const result = addMonthsUtc(new Date("2026-01-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    const result = addMonthsUtc(new Date("2024-01-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("rolls Dec 15 + 1 month into Jan 15 of the next year", () => {
    const result = addMonthsUtc(new Date("2026-12-15T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("clamps Mar 31 + 1 month to Apr 30", () => {
    const result = addMonthsUtc(new Date("2026-03-31T00:00:00.000Z"), 1);
    expect(result.toISOString()).toBe("2026-04-30T00:00:00.000Z");
  });

  it("adds 12 months to land on the same day next year", () => {
    const result = addMonthsUtc(new Date("2026-07-08T00:00:00.000Z"), 12);
    expect(result.toISOString()).toBe("2027-07-08T00:00:00.000Z");
  });

  it("preserves the time-of-day components", () => {
    const result = addMonthsUtc(new Date("2026-01-31T14:37:22.123Z"), 1);
    expect(result.toISOString()).toBe("2026-02-28T14:37:22.123Z");
  });
});
