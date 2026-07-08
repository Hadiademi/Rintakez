"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { escapeIlike } from "@/lib/search";
import { searchQuerySchema, SEARCH_GROUP_LIMIT } from "@/lib/validation/search";

export interface SearchPhotographer {
  id: string;
  display_name: string;
  city: string | null;
}

export interface SearchShoot {
  id: string;
  title: string;
}

export interface SearchSuggestions {
  photographers: SearchPhotographer[];
  shoots: SearchShoot[];
}

const EMPTY: SearchSuggestions = { photographers: [], shoots: [] };

/**
 * Typeahead suggestions for the global nav search. Reads only PUBLIC-readable
 * data via the cookieless anon client:
 *  - photographers: profiles with role='photographer', not suspended, whose
 *    display_name matches the query
 *  - shoots: open (status='open') shoots whose title matches the query
 *
 * The query is Zod-validated (trimmed, min length) and its ILIKE wildcards are
 * escaped so a literal `%` doesn't match everything. Results are capped per
 * group. Returns empty groups for an invalid/too-short query.
 */
export async function searchSuggestions(q: string): Promise<SearchSuggestions> {
  const parsed = searchQuerySchema.safeParse(q);
  if (!parsed.success) return EMPTY;

  const pattern = `%${escapeIlike(parsed.data)}%`;
  const supabase = createPublicClient();

  const [photographersRes, shootsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, city")
      .eq("role", "photographer")
      .eq("is_suspended", false)
      .ilike("display_name", pattern)
      .order("display_name", { ascending: true })
      .limit(SEARCH_GROUP_LIMIT),
    supabase
      .from("shoots")
      .select("id, title")
      .eq("status", "open")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(SEARCH_GROUP_LIMIT),
  ]);

  return {
    photographers: photographersRes.data ?? [],
    shoots: shootsRes.data ?? [],
  };
}
