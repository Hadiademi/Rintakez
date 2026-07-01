-- Profile-view collection (20260701150000_profile_views.sql): insert-only
-- counter feeding a future paid analytics dashboard. Covers the
-- record_profile_view RPC (self-view skip, daily dedupe for logged-in
-- viewers), RLS (owner-only read), and the photographer_view_count seam.
begin;
create extension if not exists pgtap;

select plan(9);

-- ── fixtures: viewer A (client) + photographer P + another user O ───────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'viewera@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Viewer A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'photop@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Photographer P"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'othero@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Other O"}', now(), now());

-- ── 1: viewer A records a view of photographer P ─────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select record_profile_view('00000000-0000-0000-0000-0000000000f2');
reset role;

select results_eq(
  $$select count(*)::int from public.profile_views
      where photographer_id = '00000000-0000-0000-0000-0000000000f2'
        and viewer_id = '00000000-0000-0000-0000-0000000000f1'$$,
  array[1],
  'record_profile_view inserts one row for viewer A on photographer P'
);

-- ── 2: calling it again the same day is idempotent (dedupe index) ───
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select record_profile_view('00000000-0000-0000-0000-0000000000f2');
select record_profile_view('00000000-0000-0000-0000-0000000000f2');
reset role;

select results_eq(
  $$select count(*)::int from public.profile_views
      where photographer_id = '00000000-0000-0000-0000-0000000000f2'
        and viewer_id = '00000000-0000-0000-0000-0000000000f1'$$,
  array[1],
  'repeat same-day views by the same logged-in viewer stay at 1 row (idempotent)'
);

-- ── 3: a self-view (P views P) records nothing ───────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select record_profile_view('00000000-0000-0000-0000-0000000000f2');
reset role;

select results_eq(
  $$select count(*)::int from public.profile_views
      where photographer_id = '00000000-0000-0000-0000-0000000000f2'
        and viewer_id = '00000000-0000-0000-0000-0000000000f2'$$,
  array[0],
  'a self-view (P views P) records nothing'
);

-- ── 4: an anon view (viewer_id null) is recorded and not deduped ────
-- Clear the leftover JWT claims from test 2/3 first — set local persists for
-- the whole transaction, and a stale sub would make auth.uid() resolve to the
-- previous user even under role anon.
set local request.jwt.claims to '';
set local role anon;
select record_profile_view('00000000-0000-0000-0000-0000000000f2');
select record_profile_view('00000000-0000-0000-0000-0000000000f2');
reset role;

select results_eq(
  $$select count(*)::int from public.profile_views
      where photographer_id = '00000000-0000-0000-0000-0000000000f2'
        and viewer_id is null$$,
  array[2],
  'anon views (viewer_id null) are recorded and are not deduped'
);

-- ── 5: photographer P can SELECT their own profile_views rows ───────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select ok(
  (select count(*)::int from public.profile_views
     where photographer_id = '00000000-0000-0000-0000-0000000000f2') >= 3,
  'photographer P can select their own profile_views rows'
);
reset role;

-- ── 6: a different user cannot read P's rows (0 rows) ────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.profile_views
      where photographer_id = '00000000-0000-0000-0000-0000000000f2'$$,
  array[0],
  'a different user (O) cannot read photographer P''s profile_views rows'
);
reset role;

-- ── 7: direct INSERT is denied (no grant; writes only via the RPC) ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok(
  $$insert into public.profile_views (photographer_id, viewer_id)
      values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'direct INSERT into profile_views is denied (no grant to authenticated)'
);
reset role;

-- ── 8: photographer_view_count returns the owner's count ─────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select results_eq(
  $$select photographer_view_count('00000000-0000-0000-0000-0000000000f2')$$,
  $$select count(*)::int from public.profile_views
      where photographer_id = '00000000-0000-0000-0000-0000000000f2'$$,
  'photographer_view_count returns the full count for the owner'
);
reset role;

-- ── 9: photographer_view_count returns 0 for a non-owner caller ─────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select results_eq(
  $$select photographer_view_count('00000000-0000-0000-0000-0000000000f2')$$,
  array[0],
  'photographer_view_count returns 0 for a non-owner caller'
);
reset role;

select * from finish();
rollback;
