/** Up to two initials from a display name (e.g. "Marko Brunner" → "MB").
 *  Code-point safe: a single-token emoji / non-BMP name won't split a surrogate
 *  pair into a broken glyph. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return [...parts[0]].slice(0, 2).join("").toUpperCase();
  return ([...parts[0]][0] + [...parts[parts.length - 1]][0]).toUpperCase();
}
