/**
 * Move the item at index `from` to index `to`, returning a new array. Used by
 * the portfolio editor for both desktop drag-and-drop and the touch up/down
 * buttons. Out-of-range targets clamp to the array bounds; an out-of-range
 * source returns an unchanged copy. Never mutates the input.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(to, next.length - 1));
  if (from === target) return next;
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
