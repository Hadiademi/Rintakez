import { describe, expect, it } from "vitest";
import { toAdminCounts } from "./counts";

describe("toAdminCounts", () => {
  it("maps head-count results to a flat count object", () => {
    expect(
      toAdminCounts({
        reports: { count: 3 },
        verifications: { count: 0 },
        disputes: { count: 1 },
        email: { count: 7 },
      })
    ).toEqual({ reports: 3, verifications: 0, disputes: 1, email: 7 });
  });

  it("treats a null count as zero rather than rendering an empty dot", () => {
    expect(
      toAdminCounts({
        reports: { count: null },
        verifications: { count: null },
        disputes: { count: null },
        email: { count: null },
      })
    ).toEqual({ reports: 0, verifications: 0, disputes: 0, email: 0 });
  });
});
