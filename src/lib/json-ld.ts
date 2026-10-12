// Characters that can break out of an inline <script> (or be misread inside
// it): "<" starts "</script>" / "<!--", ">" and "&" round out the HTML-
// significant set, and U+2028/U+2029 are line terminators in JS. Each is
// replaced by its JSON \u escape, so the output still parses to the same value.
const UNSAFE = new RegExp("[<>&\\u2028\\u2029]", "g");

function escapeChar(ch: string): string {
  return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
}

/**
 * Serialize structured data for `<script type="application/ld+json">`.
 *
 * Use this instead of a bare JSON.stringify for every JSON-LD block: the data
 * contains user-controlled strings (display names, cities), and JSON.stringify
 * leaves "</script>" intact, which would let a profile name inject a script
 * into every visitor's page.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, escapeChar);
}
