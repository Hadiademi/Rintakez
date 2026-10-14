import { describe, expect, it } from "vitest";
import {
  applyCountPrefix,
  isNewShoot,
  pageShowsIt,
  shouldRefreshFor,
} from "./live-updates";

describe("shouldRefreshFor — which pages a live notification makes stale", () => {
  it("refreshes the shoot the notification is about", () => {
    expect(shouldRefreshFor("/shoots/s1", "s1")).toBe(true);
    expect(shouldRefreshFor("/shoots/s2", "s1")).toBe(false);
    expect(shouldRefreshFor("/shoots/s1/edit", "s1")).toBe(false);
  });

  it("refreshes the overviews that list offers and bookings", () => {
    for (const path of ["/home", "/my-shoots", "/my-bids"]) {
      expect(shouldRefreshFor(path, "s1")).toBe(true);
      expect(shouldRefreshFor(path, null)).toBe(true);
    }
  });

  it("leaves forms and everything else alone", () => {
    // /notifications keeps its own list state; a refresh would only cost a render.
    for (const path of ["/shoots/new", "/profile", "/messages/c1", "/photographers", "/notifications"]) {
      expect(shouldRefreshFor(path, "s1")).toBe(false);
    }
  });
});

describe("applyCountPrefix", () => {
  it("prefixes the unread count and replaces its own earlier prefix", () => {
    expect(applyCountPrefix("Framly", "", 2)).toEqual({ title: "(2) Framly", prefix: "(2) " });
    expect(applyCountPrefix("(2) Framly", "(2) ", 5)).toEqual({ title: "(5) Framly", prefix: "(5) " });
  });

  it("caps at 9+ and removes its prefix at zero", () => {
    expect(applyCountPrefix("Framly", "", 12).title).toBe("(9+) Framly");
    expect(applyCountPrefix("(9+) Framly", "(9+) ", 0)).toEqual({ title: "Framly", prefix: "" });
  });

  it("never strips a page title that only looks like a count", () => {
    expect(applyCountPrefix("(2) Hochzeit", "", 0).title).toBe("(2) Hochzeit");
    // Next replaced the title on navigation: our old prefix is gone.
    expect(applyCountPrefix("(2) Hochzeit", "(3) ", 1).title).toBe("(1) (2) Hochzeit");
  });
});

describe("pageShowsIt — the open page answers the notification itself", () => {
  it("is the shoot the notification is about (new offer listed, won moment, status)", () => {
    expect(pageShowsIt("/shoots/s1", "bid_received", "s1")).toBe(true);
    expect(pageShowsIt("/shoots/s1", "bid_accepted", "s1")).toBe(true);
    expect(pageShowsIt("/shoots/s2", "bid_received", "s1")).toBe(false);
  });

  it("is the home page for an approved verification (its moment shows there)", () => {
    expect(pageShowsIt("/home", "verification_approved", null)).toBe(true);
    expect(pageShowsIt("/home", "bid_received", "s1")).toBe(false);
  });
});

describe("isNewShoot", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("marks shoots posted within the last 48 hours", () => {
    expect(isNewShoot("2026-10-12T13:00:00Z", now)).toBe(true);
    expect(isNewShoot("2026-10-11T11:59:00Z", now)).toBe(false);
  });

  it("ignores missing or unparsable dates", () => {
    expect(isNewShoot(null, now)).toBe(false);
    expect(isNewShoot("nope", now)).toBe(false);
  });
});
