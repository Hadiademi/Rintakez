import type { NotificationItem } from "@/lib/actions/notifications";

/**
 * Destination path for a notification, shared by the bell dropdown and the
 * full `/notifications` history page so both stay consistent.
 *
 * New message → the conversation (or the inbox if it can't be resolved).
 * Review / verification outcomes → the photographer's own profile.
 * Client bid / cancellation / invitation / match → the shoot.
 * Photographer bid outcomes (accepted/declined) → their bids.
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
  if (
    (item.type === "bid_received" ||
      item.type === "shoot_cancelled" ||
      item.type === "shoot_reopened" ||
      item.type === "shoot_invitation" ||
      item.type === "shoot_match") &&
    item.shootId
  )
    return `/shoots/${item.shootId}`;
  return "/my-bids";
}
