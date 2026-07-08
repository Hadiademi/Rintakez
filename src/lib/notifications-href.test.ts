import { describe, expect, it } from "vitest";
import { hrefFor } from "./notifications-href";
import type { NotificationItem } from "./actions/notifications";

function item(over: Partial<NotificationItem>): NotificationItem {
  return {
    id: "n1",
    type: "bid_received",
    shootId: null,
    conversationId: null,
    title: null,
    readAt: null,
    createdAt: "2026-07-03T10:00:00.000Z",
    ...over,
  };
}

describe("hrefFor", () => {
  it("links a message with a conversation to that thread", () => {
    expect(
      hrefFor(item({ type: "message_received", conversationId: "c1" }))
    ).toBe("/messages/c1");
  });

  it("falls back to the inbox when a message has no conversation", () => {
    expect(hrefFor(item({ type: "message_received" }))).toBe("/messages");
  });

  it("sends review and verification outcomes to the profile", () => {
    expect(hrefFor(item({ type: "review_received" }))).toBe("/profile");
    expect(hrefFor(item({ type: "verification_approved" }))).toBe("/profile");
    expect(hrefFor(item({ type: "verification_rejected" }))).toBe("/profile");
  });

  it("links shoot-scoped notifications to the shoot", () => {
    for (const type of [
      "bid_received",
      "shoot_cancelled",
      "shoot_reopened",
      "shoot_invitation",
      "shoot_match",
    ] as const) {
      expect(hrefFor(item({ type, shootId: "s1" }))).toBe("/shoots/s1");
    }
  });

  it("falls back to my-bids for photographer bid outcomes", () => {
    expect(hrefFor(item({ type: "bid_accepted" }))).toBe("/my-bids");
    expect(hrefFor(item({ type: "bid_declined" }))).toBe("/my-bids");
  });

  it("falls back to my-bids when a shoot-scoped type has no shoot id", () => {
    expect(hrefFor(item({ type: "bid_received", shootId: null }))).toBe(
      "/my-bids"
    );
  });
});
