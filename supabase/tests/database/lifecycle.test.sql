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
--   4) regression guard for the zero_bid_rescue "active bids" predicate
--      (src/lib/lifecycle.ts, scanZeroBidRescue): a shoot whose ONLY bid is
--      'withdrawn' must still count as having zero ACTIVE bids (i.e. remain
--      eligible for the rescue email), while a shoot with a 'pending' bid
--      must not. The eligibility check itself lives in TS (not SQL), so this
--      is expressed as a direct assertion of the corrected predicate — "not
--      exists a bid for this shoot with status in ('pending','accepted')" —
--      against seeded fixtures, mirroring exactly the `.in("status", [...])`
--      filter scanZeroBidRescue now runs.
-- email_outbox and lifecycle_email_log are both service-role only, so
-- assertions read them via `reset role` (postgres bypasses RLS), mirroring
-- the idiom in reliability.test.sql / shoot_match_alerts.test.sql.
begin;
create extension if not exists pgtap;

select plan(7);

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

-- ── 6/7: zero_bid_rescue "active bids" predicate regression guard ───
-- Fixture: a client, a photographer, and two open shoots — one whose only
-- bid is 'withdrawn', one with a live 'pending' bid.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lifecycle-zbr-client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"ZBR Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lifecycle-zbr-photog@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"ZBR Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, discipline, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, status)
values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2',
   'Withdrawn-only shoot', 'portrait', 'photo', 'A brief long enough to pass validation.',
   'Bern', 'BE', '2027-09-01', 2, 500, 900, 'open'),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2',
   'Pending-bid shoot', 'portrait', 'photo', 'A brief long enough to pass validation.',
   'Bern', 'BE', '2027-09-01', 2, 500, 900, 'open');

insert into public.bids (shoot_id, photographer_id, amount_chf, message, status)
values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f3',
   700, 'Withdrawn bid, should not count as active.', 'withdrawn'),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3',
   700, 'Pending bid, should count as active.', 'pending');

-- ── 6: a shoot whose only bid is 'withdrawn' has zero ACTIVE bids ───
select ok(
  not exists (
    select 1 from public.bids
    where shoot_id = '10000000-0000-0000-0000-0000000000f1'
      and status in ('pending', 'accepted')
  ),
  'a shoot whose only bid is withdrawn has zero active bids (zero_bid_rescue eligible)'
);

-- ── 7: a shoot with a pending bid is excluded (has an active bid) ──
select ok(
  exists (
    select 1 from public.bids
    where shoot_id = '10000000-0000-0000-0000-0000000000f2'
      and status in ('pending', 'accepted')
  ),
  'a shoot with a pending bid has an active bid (zero_bid_rescue ineligible)'
);

select * from finish();
rollback;
