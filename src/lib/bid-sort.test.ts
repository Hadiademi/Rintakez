import { describe, expect, it } from "vitest";
import { sortBids, type SortableBid } from "./bid-sort";

const A: SortableBid & { id: string } = {
  id: "a",
  amount_chf: 3800,
  createdAt: "2026-07-01T10:00:00Z",
  rating: { avg: 4.2, count: 5 },
};
const B: SortableBid & { id: string } = {
  id: "b",
  amount_chf: 2900,
  createdAt: "2026-07-02T10:00:00Z",
  rating: { avg: 4.8, count: 12 },
};
const C: SortableBid & { id: string } = {
  id: "c",
  amount_chf: 5600,
  createdAt: "2026-07-03T10:00:00Z",
  rating: { avg: 0, count: 0 },
};

const ids = (bids: { id: string }[]) => bids.map((b) => b.id);

describe("sortBids", () => {
  it("price: cheapest first", () => {
    expect(ids(sortBids([A, B, C], "price"))).toEqual(["b", "a", "c"]);
  });

  it("rating: highest average first, then most reviews", () => {
    expect(ids(sortBids([A, B, C], "rating"))).toEqual(["b", "a", "c"]);
  });

  it("newest: most recent bid first", () => {
    expect(ids(sortBids([A, B, C], "newest"))).toEqual(["c", "b", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [A, B, C];
    const snapshot = [...input];
    sortBids(input, "price");
    expect(input).toEqual(snapshot);
  });

  it("breaks equal prices by higher rating", () => {
    const x = { ...A, id: "x", amount_chf: 3000, rating: { avg: 3.0, count: 2 } };
    const y = { ...A, id: "y", amount_chf: 3000, rating: { avg: 4.5, count: 2 } };
    expect(ids(sortBids([x, y], "price"))).toEqual(["y", "x"]);
  });
});
