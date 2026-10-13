// Geometry for the celebration burst in <MomentDialog>. Pure and seeded, so a
// re-render never reshuffles a burst that is already flying and the shape of
// the effect is unit-testable. The pieces are plain spans animated by the
// `confetti-burst` keyframes in globals.css — no canvas, no dependency.

/** Colours live in CSS (`.confetti-piece[data-c="n"]`), indexed 0..size-1. */
export const CONFETTI_PALETTE_SIZE = 5;

export type ConfettiPiece = {
  /** Horizontal travel in px (negative = left). */
  x: number;
  /** Highest point of the arc in px (negative = up). */
  peak: number;
  /** Where the piece ends, below the origin, in px. */
  fall: number;
  /** Total spin in degrees. */
  rotate: number;
  delay: number;
  duration: number;
  color: number;
  shape: "rect" | "dot" | "strip";
};

// mulberry32: tiny, fast, good enough for visual jitter.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES: ConfettiPiece["shape"][] = ["rect", "rect", "dot", "strip"];

export function confettiPieces(count: number, seed: number): ConfettiPiece[] {
  const r = rng(seed);
  const between = (min: number, max: number) => min + r() * (max - min);
  return Array.from({ length: count }, (_, i) => {
    // Alternate sides so the burst is balanced even for small counts, with
    // pieces nearer the centre rising higher (a fountain, not a fan).
    const side = i % 2 === 0 ? -1 : 1;
    const spread = between(0.08, 1);
    return {
      x: Math.round(side * spread * 190),
      peak: Math.round(-between(120, 240) * (1.15 - spread * 0.45)),
      fall: Math.round(between(140, 280)),
      rotate: Math.round(between(-560, 560)),
      delay: Math.round(between(0, 140)),
      duration: Math.round(between(1100, 1700)),
      color: Math.floor(r() * CONFETTI_PALETTE_SIZE),
      shape: SHAPES[Math.floor(r() * SHAPES.length)],
    };
  });
}
