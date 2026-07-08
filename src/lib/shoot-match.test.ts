import { describe, expect, it } from "vitest";
import { photographerMatchesShoot } from "./shoot-match";

// Pure predicate extracted from notify_matching_photographers' SQL match
// logic (canton containment + discipline membership + poster exclusion), so
// scanShootMatchDigest (src/lib/lifecycle.ts) can reuse it in TypeScript
// without duplicating the SQL by hand. See P5b brief deliverable 4.

const baseShoot = {
  canton: "BE",
  discipline: "photo",
  client_id: "client-1",
};

const basePhotographer = {
  profile_id: "photog-1",
  coverage_cantons: ["BE", "ZH"],
  disciplines: ["photo", "video"],
};

describe("photographerMatchesShoot", () => {
  it("matches when canton is covered and discipline is offered", () => {
    expect(photographerMatchesShoot(baseShoot, basePhotographer)).toBe(true);
  });

  it("does not match when the shoot's canton is not in coverage_cantons", () => {
    expect(
      photographerMatchesShoot(
        { ...baseShoot, canton: "VD" },
        basePhotographer
      )
    ).toBe(false);
  });

  it("does not match when the shoot's discipline is not offered", () => {
    expect(
      photographerMatchesShoot(
        { ...baseShoot, discipline: "video" },
        { ...basePhotographer, disciplines: ["photo"] }
      )
    ).toBe(false);
  });

  it("excludes the photographer's own shoot (client_id === profile_id)", () => {
    expect(
      photographerMatchesShoot(
        { ...baseShoot, client_id: "photog-1" },
        basePhotographer
      )
    ).toBe(false);
  });

  it("does not match when coverage_cantons is empty", () => {
    expect(
      photographerMatchesShoot(baseShoot, {
        ...basePhotographer,
        coverage_cantons: [],
      })
    ).toBe(false);
  });

  it("does not match when disciplines is empty", () => {
    expect(
      photographerMatchesShoot(baseShoot, {
        ...basePhotographer,
        disciplines: [],
      })
    ).toBe(false);
  });
});
