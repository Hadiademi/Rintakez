/**
 * Fired on `window` when the current user's notifications are marked read from
 * somewhere other than the bell (e.g. the full `/notifications` page). The bell
 * lives in the persistent app layout and keeps its own unread state, so it
 * listens for this to zero its badge without a full navigation/refetch.
 */
export const NOTIFICATIONS_READ_EVENT = "notifications:read";
