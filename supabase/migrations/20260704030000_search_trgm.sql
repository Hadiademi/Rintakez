-- Performance: keep the nav/browse search fast at scale.
--
-- searchSuggestions (src/lib/actions/search.ts) runs a leading-wildcard
-- ILIKE '%q%' on profiles.display_name and (status='open') shoots.title. A
-- leading wildcard cannot use a btree index, so it scans ~linearly with row
-- count — fine on the seed, degrades as the platform grows. pg_trgm makes
-- leading-wildcard ILIKE index-accelerated via a GIN trigram index.
--
-- pg_trgm lives in the `extensions` schema per Supabase convention (pgcrypto,
-- pgtap, etc. already live there — see existing migrations/tests). The operator
-- class is referenced schema-qualified (extensions.gin_trgm_ops) so it resolves
-- regardless of search_path.
create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_display_name_trgm
  on public.profiles using gin (display_name extensions.gin_trgm_ops);

create index if not exists shoots_title_trgm
  on public.shoots using gin (title extensions.gin_trgm_ops);
