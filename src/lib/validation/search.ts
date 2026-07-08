import { z } from "zod";

/** Minimum query length before the typeahead fires a request. */
export const SEARCH_MIN_CHARS = 2;

/** Max results returned per group (photographers / shoots). */
export const SEARCH_GROUP_LIMIT = 5;

/**
 * Trimmed suggestion query. Must be at least SEARCH_MIN_CHARS after trimming;
 * capped to keep the ILIKE pattern bounded.
 */
export const searchQuerySchema = z
  .string()
  .trim()
  .min(SEARCH_MIN_CHARS)
  .max(100);
