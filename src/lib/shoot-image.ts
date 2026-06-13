// Deterministic cover images for shoots & photographers.
//
// The schema has no cover-image column for shoots, so — matching the design
// prototype — we map each shoot to a curated, editorial Unsplash photo by its
// type. A stable hash of the shoot id picks one photo from the per-type pool so
// two shoots of the same type don't collapse to the same image.

const UN = (id: string, w = 900, h = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

// Curated Unsplash IDs per shoot type (alpine / studio / documentary), carried
// over from the prototype so the seed shoots match the approved design exactly.
const SHOOT_PHOTOS: Record<string, string[]> = {
  wedding: ["1519741497674-611481863552", "1511285560929-80b456fea0bc"],
  portrait: ["1545167622-3a6ac756afa4", "1506794778202-cad84cf45f1d"],
  commercial: ["1556228720-195a672e8a03", "1551632811-561732d1e306"],
  event: ["1492684223066-81342ee5ff30", "1470229722913-7c0e2dbbafd3"],
  architecture: ["1486325212027-8081e485255e", "1487958449943-2429e8be8625"],
  family: ["1506905925346-21bda4d32df4", "1511895426328-dc8714191300"],
  other: ["1554080353-a576cf803bda", "1452587925148-ce544e77e70d"],
};

// Curated portrait IDs for photographer avatars.
const PHOTOGRAPHER_AVATARS = [
  "1438761681033-6461ffad8d80",
  "1500648767791-00dcc994a43e",
  "1472099645785-5658abf4ff4e",
  "1534528741775-53994a69daeb",
  "1507003211169-0a1dd7228f2d",
  "1544005313-94ddf0286df2",
];

/** Stable, order-independent hash of a string → non-negative integer. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Editorial cover image URL for a shoot, deterministic per id. */
export function shootImage(type: string, id: string, w = 900, h = 600): string {
  const pool = SHOOT_PHOTOS[type] ?? SHOOT_PHOTOS.other;
  return UN(pool[hash(id) % pool.length], w, h);
}

/** Deterministic avatar image URL for a photographer profile. */
export function photographerAvatar(id: string, w = 240, h = 240): string {
  return UN(PHOTOGRAPHER_AVATARS[hash(id) % PHOTOGRAPHER_AVATARS.length], w, h);
}
