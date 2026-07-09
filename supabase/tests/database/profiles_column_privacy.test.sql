-- Column-scoped SELECT grant on profiles from
-- 20260709000000_profiles_column_privacy.sql (WI-1 security). Before this
-- migration, `grant select on public.profiles to anon, authenticated` was
-- TABLE-WIDE, so any anon caller could read is_admin/is_suspended/notify_*/
-- terms_* for every row via PostgREST (an enumeration leak). The fix keeps
-- `profiles_select_all using (true)` intact but narrows the column-level
-- grant to a safe public-identity allowlist, and routes the caller's own
-- full-row read through the `current_profile()` SECURITY DEFINER function
-- (which bypasses the column grant for the row matching auth.uid() only).
begin;
create extension if not exists pgtap;

select plan(15);

-- ── fixtures: 2 non-admin users (client U1 + photographer U2) ──────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cpe1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Privacy Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cpe2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Privacy Photographer"}', now(), now());

-- Give U1 distinctive sensitive values (superuser update, bypasses RLS/grants)
-- so the current_profile() assertions below can prove it returns the REAL
-- values for the caller's own row, not just non-null placeholders.
update public.profiles set
  is_admin = true,
  is_suspended = true,
  suspension_reason = 'test suspension',
  notify_bids = false,
  notify_shoot_updates = false,
  notify_messages = false,
  terms_accepted_at = '2027-01-01T00:00:00Z',
  terms_version = 'v9'
where id = '00000000-0000-0000-0000-0000000000e1';

-- ── 1-4: anon cannot read sensitive columns (the enumeration leak) ──────
set local role anon;
select throws_ok(
  $$select is_admin from public.profiles$$,
  '42501', null,
  'anon cannot select is_admin (admin enumeration closed)'
);
select throws_ok(
  $$select notify_bids from public.profiles$$,
  '42501', null,
  'anon cannot select notify_bids'
);
select throws_ok(
  $$select suspension_reason from public.profiles$$,
  '42501', null,
  'anon cannot select suspension_reason'
);
select throws_ok(
  $$select terms_accepted_at from public.profiles$$,
  '42501', null,
  'anon cannot select terms_accepted_at'
);

-- ── 5-6: anon can still read the safe public-identity columns ──────────
select lives_ok(
  $$select display_name from public.profiles$$,
  'anon can still select display_name (directory/public pages unaffected)'
);
select lives_ok(
  $$select is_suspended from public.profiles$$,
  'anon can still select is_suspended (kept readable; hides suspended users)'
);

-- ── 7: anon cannot execute current_profile() either ─────────────────────
select throws_ok(
  $$select * from public.current_profile()$$,
  '42501', null,
  'anon cannot execute current_profile()'
);
reset role;

-- ── 8-10: authenticated cross-user reads ────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

select throws_ok(
  $$select is_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000e2'$$,
  '42501', null,
  'an authenticated user cannot read another user''s is_admin'
);
select throws_ok(
  $$select notify_shoot_updates from public.profiles where id = '00000000-0000-0000-0000-0000000000e2'$$,
  '42501', null,
  'an authenticated user cannot read another user''s notify_shoot_updates'
);
select lives_ok(
  $$select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000e2'$$,
  'an authenticated user can still read another user''s display_name (directory/embeds unaffected)'
);

-- ── 11-12: column privilege gates OWN-row reads too (row match is not
--           enough — proves getProfile/privacy export MUST use
--           current_profile() rather than a plain select on their own id) ──
select throws_ok(
  $$select is_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501', null,
  'a user cannot read their OWN is_admin via a plain select (must use current_profile())'
);
select throws_ok(
  $$select notify_bids from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501', null,
  'a user cannot read their OWN notify_bids via a plain select (must use current_profile())'
);

-- ── 13: current_profile() returns the caller's full own row, including
--        every sensitive column, exactly as set above ─────────────────
select results_eq(
  $$select id, is_admin, is_suspended, suspension_reason, notify_bids,
           notify_shoot_updates, notify_messages, terms_version
      from public.current_profile()$$,
  $$values ('00000000-0000-0000-0000-0000000000e1'::uuid, true, true,
            'test suspension'::text, false, false, false, 'v9'::text)$$,
  'current_profile() returns the caller''s own sensitive columns, unredacted'
);
reset role;

-- ── 14: current_profile() is per-caller — U2 gets U2's row, not U1's ────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select results_eq(
  $$select id from public.current_profile()$$,
  array['00000000-0000-0000-0000-0000000000e2'::uuid],
  'current_profile() scopes to the calling user, not a fixed row'
);
reset role;

-- ── 15: sanity — service_role (the admin panel's reader) is unaffected ──
set local role service_role;
select results_eq(
  $$select is_admin from public.profiles where id = '00000000-0000-0000-0000-0000000000e1'$$,
  array[true],
  'service_role can still select is_admin directly (admin panel path)'
);
reset role;

select * from finish();
rollback;
