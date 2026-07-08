-- Structural coverage for the pg_trgm GIN indexes added in
-- 20260704030000_search_trgm.sql, which keep the leading-wildcard ILIKE '%q%'
-- search (src/lib/actions/search.ts) index-accelerated at scale.
--
-- We assert the two indexes EXIST and that ILIKE still returns the expected
-- rows (the index must not change results). We deliberately do NOT assert that
-- EXPLAIN chooses the index: at seed/fixture row counts the planner correctly
-- prefers a seq scan, so an index-usage assertion would be flaky. The index's
-- purpose is realised only once the tables grow large.
begin;
create extension if not exists pgtap;

select plan(3);

-- ── 1 & 2: both trigram GIN indexes exist ──────────────────────────────
select has_index(
  'public', 'profiles', 'profiles_display_name_trgm',
  'trigram GIN index on profiles.display_name exists'
);
select has_index(
  'public', 'shoots', 'shoots_title_trgm',
  'trigram GIN index on shoots.title exists'
);

-- ── 3: correctness sanity — ILIKE '%mar%' still finds Marko ────────────
-- Self-contained fixture (a photographer profile is created by the auth trigger)
-- so the test does not depend on seed rows staying constant.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'trgm-marko@test.ch',
   extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Marko Trigram"}', now(), now());

select results_eq(
  $$ select display_name from public.profiles
       where display_name ilike '%mar%'
         and id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('Marko Trigram'::text) $$,
  'ILIKE ''%mar%'' returns the Marko fixture (index does not change results)'
);

select * from finish();
rollback;
