import { describe, expect, it } from "vitest";
import {
  scoreProfileCompleteness,
  type ProfileCompletenessInput,
} from "./profile-completeness";

const EMPTY: ProfileCompletenessInput = {
  hasAvatar: false,
  bioLength: 0,
  portfolioCount: 0,
  hasRate: false,
  cantonsCount: 0,
  specialtiesCount: 0,
  verificationStatus: "unverified",
};

const FULL: ProfileCompletenessInput = {
  hasAvatar: true,
  bioLength: 120,
  portfolioCount: 5,
  hasRate: true,
  cantonsCount: 2,
  specialtiesCount: 3,
  verificationStatus: "verified",
};

const item = (result: ReturnType<typeof scoreProfileCompleteness>, key: string) =>
  result.items.find((i) => i.key === key)!;

describe("scoreProfileCompleteness", () => {
  it("empty profile scores 0 and marks nothing done", () => {
    const r = scoreProfileCompleteness(EMPTY);
    expect(r.score).toBe(0);
    expect(r.items.every((i) => !i.done)).toBe(true);
  });

  it("fully completed profile scores exactly 100 with everything done", () => {
    const r = scoreProfileCompleteness(FULL);
    expect(r.score).toBe(100);
    expect(r.items.every((i) => i.done)).toBe(true);
  });

  it("weights sum to 100 across all items", () => {
    const r = scoreProfileCompleteness(FULL);
    expect(r.items.reduce((sum, i) => sum + i.weight, 0)).toBe(100);
  });

  it("avatar contributes 15", () => {
    const r = scoreProfileCompleteness({ ...EMPTY, hasAvatar: true });
    expect(r.score).toBe(15);
    expect(item(r, "avatar").done).toBe(true);
  });

  it("bio counts only at >=80 chars", () => {
    expect(scoreProfileCompleteness({ ...EMPTY, bioLength: 79 }).score).toBe(0);
    const r = scoreProfileCompleteness({ ...EMPTY, bioLength: 80 });
    expect(r.score).toBe(15);
    expect(item(r, "bio").done).toBe(true);
  });

  it("hourly rate contributes 10", () => {
    expect(scoreProfileCompleteness({ ...EMPTY, hasRate: true }).score).toBe(10);
  });

  it("coverage cantons contribute 10", () => {
    expect(scoreProfileCompleteness({ ...EMPTY, cantonsCount: 1 }).score).toBe(10);
  });

  it("specialties contribute 10", () => {
    expect(
      scoreProfileCompleteness({ ...EMPTY, specialtiesCount: 1 }).score
    ).toBe(10);
  });

  it("verification counts for pending and verified, not rejected/unverified", () => {
    expect(
      scoreProfileCompleteness({ ...EMPTY, verificationStatus: "pending" }).score
    ).toBe(15);
    expect(
      scoreProfileCompleteness({ ...EMPTY, verificationStatus: "verified" }).score
    ).toBe(15);
    expect(
      scoreProfileCompleteness({ ...EMPTY, verificationStatus: "rejected" }).score
    ).toBe(0);
    expect(
      scoreProfileCompleteness({ ...EMPTY, verificationStatus: "unverified" })
        .score
    ).toBe(0);
  });

  it("portfolio gives full 25 at >=3 images and marks done", () => {
    const r = scoreProfileCompleteness({ ...EMPTY, portfolioCount: 3 });
    expect(r.score).toBe(25);
    expect(item(r, "portfolio").done).toBe(true);
  });

  it("portfolio is capped at 25 beyond 3 images", () => {
    expect(
      scoreProfileCompleteness({ ...EMPTY, portfolioCount: 9 }).score
    ).toBe(25);
  });

  it("portfolio gives partial credit per image below 3 (not done)", () => {
    const one = scoreProfileCompleteness({ ...EMPTY, portfolioCount: 1 });
    const two = scoreProfileCompleteness({ ...EMPTY, portfolioCount: 2 });
    // min(count,3)/3 * 25, rounded into the final score
    expect(one.score).toBe(8); // 8.33 -> 8
    expect(two.score).toBe(17); // 16.67 -> 17
    expect(item(one, "portfolio").done).toBe(false);
    expect(item(two, "portfolio").done).toBe(false);
  });

  it("every item exposes an href to an edit surface", () => {
    const r = scoreProfileCompleteness(EMPTY);
    expect(r.items.every((i) => typeof i.href === "string" && i.href.length > 0)).toBe(
      true
    );
  });

  it("orders items by weight descending so the first missing are the biggest wins", () => {
    const weights = scoreProfileCompleteness(EMPTY).items.map((i) => i.weight);
    const sorted = [...weights].sort((a, b) => b - a);
    expect(weights).toEqual(sorted);
  });
});
