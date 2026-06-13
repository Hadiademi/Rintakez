import { describe, expect, it } from "vitest";
import { formatCHF, formatCHFRange, formatSwissDate } from "./format";

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
