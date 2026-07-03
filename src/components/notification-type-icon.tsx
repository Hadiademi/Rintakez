import type { NotificationItem } from "@/lib/actions/notifications";

const SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** A restrained per-type glyph for a notification row. Notifications are
 *  grouped into a few visual families (message, offer, positive, negative,
 *  shoot, review) rather than a bespoke icon per type. */
export function NotificationTypeIcon({
  type,
}: {
  type: NotificationItem["type"];
}) {
  switch (type) {
    case "message_received":
      return (
        <svg {...SVG_PROPS}>
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
        </svg>
      );
    case "review_received":
      return (
        <svg {...SVG_PROPS}>
          <path d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.2l1-5.8-4.2-4.1 5.9-.9z" />
        </svg>
      );
    case "bid_received":
      return (
        <svg {...SVG_PROPS}>
          <path d="M20.6 13.4 12 22l-9-9V4h9z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      );
    case "bid_accepted":
    case "verification_approved":
      return (
        <svg {...SVG_PROPS}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.3 2.3 4.7-5" />
        </svg>
      );
    case "bid_declined":
    case "shoot_cancelled":
    case "verification_rejected":
      return (
        <svg {...SVG_PROPS}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      );
    case "shoot_reopened":
      return (
        <svg {...SVG_PROPS}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v4h-4" />
        </svg>
      );
    case "shoot_invitation":
    case "shoot_match":
    default:
      return (
        <svg {...SVG_PROPS}>
          <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-1.8h7.6L17 7h2.5A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>
      );
  }
}
