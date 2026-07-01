-- Lifecycle emails (Task C2, 20260701070000_welcome_email.sql +
-- 20260701080000_lifecycle_markers.sql):
--   1) inserting a profile (which happens once per signup, via
--      public.handle_new_user() on auth.users) enqueues exactly one
--      'welcome' email_outbox row for that profile;
--   2) public.lifecycle_email_log — the idempotency marker used by the
--      onboarding_reminder/zero_bid_rescue/review_request cron scans — is not
--      readable (or writable) by an authenticated user, same posture as
--      email_outbox: service-role only, RLS enabled with no grants;
--   3) the (kind, subject_id) primary key is the mechanical guarantee the TS
--      scans (src/lib/lifecycle.ts) rely on: even if a scan's own "already
--      logged" pre-check had a bug, the DB itself refuses a second
--      (kind, subject_id) row, so the same subject can never be marked twice
--      for the same lifecycle email.
-- email_outbox and lifecycle_email_log are both service-role only, so
-- assertions read them via `reset role` (postgres bypasses RLS), mirroring
-- the idiom in reliability.test.sql / shoot_match_alerts.test.sql.
begin;
create extension if not exists pgtap;

select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lifecycle-welcome@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Lifecycle Client"}', now(), now());

-- ── 1: the auth.users insert cascaded into a profiles insert ────────
select is(
  (select count(*)::int from public.profiles
   where id = '00000000-0000-0000-0000-0000000000f1'),
  1,
  'signup created exactly one profile row'
);

-- ── 2: that profile insert enqueued exactly one welcome email ───────
-- Read email_outbox as postgres (service-role only / RLS-protected from authenticated).
reset role;
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000f1'
     and kind = 'welcome'),
  1,
  'profile insert enqueues exactly one welcome email'
);

-- ── 3: lifecycle_email_log is not readable by an authenticated user ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok(
  $$select * from public.lifecycle_email_log$$,
  '42501',
  null,
  'authenticated users cannot read lifecycle_email_log'
);

-- ── 4: lifecycle_email_log is not writable by an authenticated user ─
select throws_ok(
  $$insert into public.lifecycle_email_log (kind, subject_id)
    values ('onboarding_reminder', '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'authenticated users cannot write lifecycle_email_log'
);
reset role;

-- ── 5: (kind, subject_id) primary key blocks a duplicate marker ────
insert into public.lifecycle_email_log (kind, subject_id)
values ('onboarding_reminder', '00000000-0000-0000-0000-0000000000f1');

select throws_ok(
  $$insert into public.lifecycle_email_log (kind, subject_id)
    values ('onboarding_reminder', '00000000-0000-0000-0000-0000000000f1')$$,
  '23505',
  null,
  'a second marker for the same (kind, subject_id) is rejected'
);

select * from finish();
rollback;
