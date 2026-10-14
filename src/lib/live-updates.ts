// Pure rules behind the app's live behaviour (NotificationBell): which page a
// realtime notification makes stale, the unread count in the tab title, and
// the "new" marker on shoot cards.

/**
 * Overviews that list offers or bookings. (/notifications keeps its own list
 * state, so a refresh there would only cost a render.)
 */
const OVERVIEW_PATHS = new Set(["/home", "/my-shoots", "/my-bids"]);

/**
 * Whether a notification arriving while `pathname` (locale-less) is open makes
 * that page stale enough to refresh it in place. Forms and unrelated pages are
 * never refreshed under the user's hands.
 */
export function shouldRefreshFor(pathname: string, shootId: string | null): boolean {
  if (OVERVIEW_PATHS.has(pathname)) return true;
  return shootId !== null && pathname === `/shoots/${shootId}`;
}

/**
 * Whether the open page itself shows what a notification says once it
 * refreshes — the offer appears in the shoot's list, the won moment opens,
 * the verified moment on home — so a toast would say it twice.
 */
export function pageShowsIt(
  pathname: string,
  type: string,
  shootId: string | null
): boolean {
  if (shootId !== null && pathname === `/shoots/${shootId}`) return true;
  return type === "verification_approved" && pathname === "/home";
}

/**
 * "(3) Framly" — the unread count leads the tab title; 0 removes it. Only
 * the prefix this function added last time (`prevPrefix`) is ever stripped,
 * so a page title that merely looks like a count is left alone.
 */
export function applyCountPrefix(
  title: string,
  prevPrefix: string,
  count: number
): { title: string; prefix: string } {
  const base =
    prevPrefix && title.startsWith(prevPrefix) ? title.slice(prevPrefix.length) : title;
  const prefix = count > 0 ? `(${count > 9 ? "9+" : count}) ` : "";
  return { title: prefix + base, prefix };
}

const NEW_SHOOT_MS = 48 * 60 * 60 * 1000;

/** Posted within the last 48 hours. */
export function isNewShoot(createdAt: string | null, now: Date): boolean {
  if (!createdAt) return false;
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return false;
  return now.getTime() - at < NEW_SHOOT_MS;
}
