import type { NotificationItem } from "@/lib/actions/notifications";

/**
 * Destination path for a notification, shared by the bell dropdown and the
 * full `/notifications` history page so both stay consistent.
 *
 * New message → the conversation (or the inbox if it can't be resolved).
 * Review / verification outcomes → the photographer's own profile.
 * Declined offer → their bids.
 * Everything else is about a shoot → that shoot (offers, the won moment,
 * edits, cancellations, disputes, expiry); my-bids if the shoot is gone.
 */
export function hrefFor(item: NotificationItem): string {
  if (item.type === "message_received")
    return item.conversationId
      ? `/messages/${item.conversationId}`
      : "/messages";
  if (
    item.type === "review_received" ||
    item.type === "verification_approved" ||
    item.type === "verification_rejected"
  )
    return "/profile";
  if (item.type !== "bid_declined" && item.shootId)
    return `/shoots/${item.shootId}`;
  return "/my-bids";
}
