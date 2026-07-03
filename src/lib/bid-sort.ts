/**
 * Sort modes for the owner's bid-comparison grid.
 * - "price": ascending amount (cheapest first)
 * - "rating": descending average rating, then descending review count
 * - "newest": most recently submitted bid first
 *
 * No mode is a "recommended" default — the grid highlights nothing, so the
 * order is purely the axis the owner chose to reason along.
 */
export type BidSortMode = "price" | "rating" | "newest";

export type SortableBid = {
  amount_chf: number;
  /** ISO timestamp the bid was submitted. */
  createdAt: string;
  rating: { avg: number; count: number };
};

/**
 * Returns a NEW array sorted by the chosen axis (never mutates the input).
 * Sorts are total (stable tiebreakers) so the same set always renders in the
 * same order for a given mode.
 */
export function sortBids<T extends SortableBid>(
  bids: readonly T[],
  mode: BidSortMode
): T[] {
  const copy = [...bids];
  copy.sort((a, b) => {
    if (mode === "price") {
      return (
        a.amount_chf - b.amount_chf ||
        b.rating.avg - a.rating.avg ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    if (mode === "rating") {
      return (
        b.rating.avg - a.rating.avg ||
        b.rating.count - a.rating.count ||
        a.amount_chf - b.amount_chf
      );
    }
    // newest
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      a.amount_chf - b.amount_chf
    );
  });
  return copy;
}
