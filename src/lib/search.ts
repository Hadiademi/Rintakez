/**
 * Pure helpers for the global nav typeahead. Kept free of any server/client
 * concern so they can be unit-tested and imported from both the `"use server"`
 * action (escapeIlike) and the client dropdown (highlightSegments).
 */

/**
 * Escape the Postgres ILIKE wildcards (`%`, `_`) and the escape char (`\`) in a
 * user-supplied query so they match literally. Without this, a search for `%`
 * would match every row. Backslash is handled by the same single pass — each
 * special char is prefixed with one backslash independently.
 */
export function escapeIlike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * Split `text` into consecutive segments, marking every case-insensitive,
 * non-overlapping occurrence of `query` as a match while preserving the
 * original casing of `text`. An empty query (or no match) yields a single
 * unmatched segment covering the whole string.
 */
export function highlightSegments(
  text: string,
  query: string
): HighlightSegment[] {
  const needle = query.toLowerCase();
  if (needle.length === 0) return [{ text, match: false }];

  const hay = text.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (;;) {
    const idx = hay.indexOf(needle, cursor);
    if (idx === -1) break;
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), match: false });
    }
    segments.push({ text: text.slice(idx, idx + needle.length), match: true });
    cursor = idx + needle.length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), match: false });
  }

  return segments.length > 0 ? segments : [{ text, match: false }];
}
