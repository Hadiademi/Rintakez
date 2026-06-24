const KNOWN = new Set([
  "invalid_input",
  "unauthorized",
  "forbidden",
  "already_bid",
  "already_reviewed",
  "not_found",
  "limit_reached",
  "invalid_file",
]);

/** Map an action error string to a stable i18n key under the `errors` namespace.
 *  Unknown/raw DB strings collapse to `generic` so internals never leak. */
export function errorKey(error: string): string {
  return KNOWN.has(error) ? error : "generic";
}
