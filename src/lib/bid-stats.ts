/**
 * Pure acceptance-rate helper for the photographer dashboard (subs-P6):
 * fraction of a photographer's bids that were accepted. Division-by-zero is
 * guarded — an empty bid list has no meaningful rate, so it returns null
 * rather than NaN or 0 (0 would misleadingly read as "0% acceptance").
 */
export function acceptanceRate(bids: { status: string }[]): number | null {
  const total = bids.length;
  if (total === 0) return null;
  const accepted = bids.filter((b) => b.status === "accepted").length;
  return accepted / total;
}
