import { describe, expect, it } from "vitest";
import { acceptanceRate } from "./bid-stats";

const bids = (statuses: string[]) => statuses.map((status) => ({ status }));

describe("acceptanceRate", () => {
  it("2 accepted of 4 → 0.5", () => {
    expect(
      acceptanceRate(bids(["accepted", "accepted", "pending", "declined"]))
    ).toBe(0.5);
  });

  it("0 bids → null", () => {
    expect(acceptanceRate([])).toBeNull();
  });

  it("all accepted → 1", () => {
    expect(acceptanceRate(bids(["accepted", "accepted"]))).toBe(1);
  });

  it("no accepted → 0", () => {
    expect(acceptanceRate(bids(["pending", "declined"]))).toBe(0);
  });
});
