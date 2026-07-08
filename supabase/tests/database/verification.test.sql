-- Photographer verification from 20260622020000_verification.sql (gap A2).
-- A photographer cannot self-set verification_status (column grant excludes it);
-- request_verification() flips their own row to 'pending' but never overrides an
-- already-verified status.
begin;
create extension if not exists pgtap;

select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vere1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Ver One"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vere2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Ver Two"}', now(), now());

insert into public.photographer_details (profile_id)
values
  ('00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000e2');

update public.photographer_details set verification_status = 'verified'
  where profile_id = '00000000-0000-0000-0000-0000000000e2';

-- ── 1: a photographer cannot self-set verification_status ────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select throws_ok(
  $$update public.photographer_details set verification_status = 'verified'
      where profile_id = '00000000-0000-0000-0000-0000000000e1'$$,
  '42501',
  null,
  'a photographer cannot directly update their verification_status'
);
reset role;

-- ── 2: request_verification flips unverified -> pending ──────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select public.request_verification();
reset role;
select results_eq(
  $$select verification_status::text from public.photographer_details
      where profile_id = '00000000-0000-0000-0000-0000000000e1'$$,
  array['pending'],
  'request_verification moves an unverified photographer to pending'
);

-- ── 3: request_verification never downgrades a verified photographer ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select public.request_verification();
reset role;
select results_eq(
  $$select verification_status::text from public.photographer_details
      where profile_id = '00000000-0000-0000-0000-0000000000e2'$$,
  array['verified'],
  'request_verification is a no-op for an already-verified photographer'
);

select * from finish();
rollback;
