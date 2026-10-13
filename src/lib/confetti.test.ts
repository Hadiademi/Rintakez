import { describe, expect, it } from "vitest";
import { CONFETTI_PALETTE_SIZE, confettiPieces } from "./confetti";

describe("confettiPieces", () => {
  it("returns the requested number of pieces", () => {
    expect(confettiPieces(36, 7)).toHaveLength(36);
  });

  it("is deterministic for a seed, so a re-render never reshuffles the burst", () => {
    expect(confettiPieces(24, 42)).toEqual(confettiPieces(24, 42));
  });

  it("varies with the seed", () => {
    expect(confettiPieces(24, 1)).not.toEqual(confettiPieces(24, 2));
  });

  it("bursts upwards and outwards to both sides, then falls", () => {
    const pieces = confettiPieces(48, 3);
    expect(pieces.some((p) => p.x < 0)).toBe(true);
    expect(pieces.some((p) => p.x > 0)).toBe(true);
    for (const p of pieces) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(200);
      expect(p.peak).toBeLessThan(0); // rises first (negative y is up)
      expect(p.fall).toBeGreaterThan(0); // ends below the origin
      expect(p.delay).toBeGreaterThanOrEqual(0);
      expect(p.duration).toBeGreaterThanOrEqual(1000);
      expect(p.duration).toBeLessThanOrEqual(1800);
      expect(p.color).toBeGreaterThanOrEqual(0);
      expect(p.color).toBeLessThan(CONFETTI_PALETTE_SIZE);
      expect(["rect", "dot", "strip"]).toContain(p.shape);
    }
  });
});
