-- admin_liquidity_stats() from 20260701160000_admin_liquidity_stats.sql:
-- zero-bid open-shoot count, median bids/open shoot, median hours-to-first-bid,
-- and invites sent in the last 7 days — for the owner's admin dashboard.
-- The function is service_role-only (no authenticated/anon grant), since the
-- admin page reads it through the service-role client, not a user session.
--
-- Note: supabase/seed.sql already seeds a few open shoots (some with bids,
-- some without), so assertions below are expressed as deltas against a
-- "before" snapshot rather than absolute counts, to stay correct regardless
-- of what the seed data happens to contain.
begin;
create extension if not exists pgtap;

select plan(7);

-- Call as service_role throughout, matching how the admin dashboard reads
-- this function (createAdminClient() uses the service-role key).
set local role service_role;

-- Baseline, before this test's own fixtures are inserted.
create temp table liq_before as
  select public.admin_liquidity_stats() as stats;

reset role;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'liq-c1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Liquidity Client 1"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'liq-c2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Liquidity Client 2"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'liq-p1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Liquidity Photographer 1"}', now(), now());

-- Shoot A: open, no bids at all -> adds exactly 1 to zero_bid_open.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, status, created_at)
values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
   'Zero-bid open shoot', 'portrait', 'A brief long enough to pass validation.', 'Bern', 'BE',
   '2027-09-01', 2, 500, 900, 'open', now() - interval '3 days');

-- Shoot B: open, with one bid submitted 5 hours after the shoot was created.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, status, created_at)
values
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2',
   'Open shoot with one bid', 'portrait', 'A brief long enough to pass validation.', 'Zurich', 'ZH',
   '2027-09-05', 2, 500, 900, 'open', now() - interval '2 days');

insert into public.bids (shoot_id, photographer_id, amount_chf, message, status, created_at)
values
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3',
   700, 'Happy to shoot this, available all week.', 'pending',
   (now() - interval '2 days') + interval '5 hours');

-- One invitation sent within the last 7 days (client A invites photographer 1
-- to shoot B, which is fine for this test — invites don't require the target
-- to be idle).
insert into public.shoot_invitations (shoot_id, photographer_id, client_id, created_at)
values
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-0000000000a2', now() - interval '1 day');

-- An invitation from 8 days ago must NOT be counted in the 7-day window.
insert into public.shoot_invitations (shoot_id, photographer_id, client_id, created_at)
values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-0000000000a1', now() - interval '8 days');

set local role service_role;

create temp table liq_after as
  select public.admin_liquidity_stats() as stats;

select is(
  (
    (select (stats ->> 'zero_bid_open')::int from liq_after)
    - (select (stats ->> 'zero_bid_open')::int from liq_before)
  ),
  1,
  'zero_bid_open increases by exactly 1 for the one new open shoot with no active bids'
);

select is(
  (
    (select (stats ->> 'invites_sent_7d')::int from liq_after)
    - (select (stats ->> 'invites_sent_7d')::int from liq_before)
  ),
  1,
  'invites_sent_7d increases by exactly 1 — only the invitation within the last 7 days counts'
);

select isnt(
  (select stats ->> 'median_bids_per_open_shoot' from liq_after),
  null,
  'median_bids_per_open_shoot is non-null when there are open shoots'
);

select ok(
  (select (stats ->> 'median_bids_per_open_shoot')::numeric from liq_after) >= 0,
  'median_bids_per_open_shoot is a plausible non-negative number'
);

select isnt(
  (select stats ->> 'median_hours_to_first_bid' from liq_after),
  null,
  'median_hours_to_first_bid is non-null when at least one shoot has a bid'
);

select ok(
  (select (stats ->> 'median_hours_to_first_bid')::numeric from liq_after) >= 0,
  'median_hours_to_first_bid is a plausible non-negative number'
);

reset role;

-- admin_liquidity_stats() is granted to service_role only — no
-- authenticated/anon grant, since it aggregates across every client's shoots
-- and must never be reachable from a logged-in browser session.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$select public.admin_liquidity_stats()$$,
  '42501',
  null,
  'admin_liquidity_stats is not executable by authenticated'
);
reset role;

select * from finish();
rollback;
