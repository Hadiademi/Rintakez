-- Premium benchmark RPC (20260708100000_platform_benchmark.sql):
-- platform_median_acceptance_rate() self-checks premium entitlement IN SQL
-- (via photographer_effective_tier) so a UI bypass can't leak it, and is
-- aggregate-only with TWO k-anonymity guards: (1) a photographer needs
-- >=3 bids to contribute a rate, and (2) at least 3 photographers must
-- contribute before a median is returned (otherwise NULL) — guard (2) is
-- what stops percentile_cont from just handing back a single contributor's
-- exact rate when only one/two photographers qualify.
begin;
create extension if not exists pgtap;

select plan(5);

-- ── fixtures: a client + several photographers with differing tiers ─────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000c0', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'benchc0@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Bench Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'benchc1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Bench Free"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'benchc2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Bench Standard"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'benchc3@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Bench Premium"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'benchc4@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Bench Sample A"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'benchc5@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Bench Sample B"}', now(), now());

insert into public.photographer_details (profile_id, plan_tier, plan_expires_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'free', null),
  ('00000000-0000-0000-0000-0000000000c2', 'standard', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000c3', 'premium', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000c4', 'standard', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000c5', 'standard', now() + interval '30 days');

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c0',
   'Bench shoot 1', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH',
   '2028-01-01', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c0',
   'Bench shoot 2', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH',
   '2028-01-02', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c0',
   'Bench shoot 3', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH',
   '2028-01-03', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c0',
   'Bench shoot 4', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH',
   '2028-01-04', 2, 500, 900);

-- ── insufficient-sample scenario ──────────────────────────────────────
-- The demo seed (supabase/seed.sql) already has one photographer, Marko
-- (...0003), who legitimately reaches the per-photographer >=3-bids
-- threshold (3 bids: 2 accepted, 1 pending) — the exact single-contributor
-- leak this fix closes. Claire (...0004) only has 2 seeded bids and does
-- not qualify. Here none of the test photographers (c3, c4, c5) reach the
-- >=3-bids threshold either, so system-wide there is still only ONE
-- contributing photographer (Marko) and the outer "≥3 contributing
-- photographers" guard must return NULL for a premium caller.
savepoint bid_fixtures;

insert into public.bids (shoot_id, photographer_id, amount_chf, message, status) values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', 600, 'Message long enough to pass.', 'accepted'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', 600, 'Message long enough to pass.', 'declined'),

  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c4', 550, 'Message long enough to pass.', 'accepted'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', 550, 'Message long enough to pass.', 'declined'),

  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c5', 700, 'Message long enough to pass.', 'declined');

-- ── 5: premium caller, but fewer than 3 contributing photographers → NULL ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select is(
  (select platform_median_acceptance_rate()),
  null::numeric,
  'a premium-tier caller gets NULL when fewer than 3 photographers meet the sample-size guard'
);
reset role;

rollback to savepoint bid_fixtures;

-- ── sufficient-sample scenario: c3 (premium), c4, c5 (standard) each get
-- >=3 bids so the per-photographer guard (having count(*) >= 3) admits all
-- three of them, satisfying the outer >=3-contributing-photographers guard
-- too and letting the percentile actually be computed.
insert into public.bids (shoot_id, photographer_id, amount_chf, message, status) values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', 600, 'Message long enough to pass.', 'accepted'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c3', 600, 'Message long enough to pass.', 'accepted'),
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c3', 600, 'Message long enough to pass.', 'declined'),
  ('10000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c3', 600, 'Message long enough to pass.', 'pending'),

  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c4', 550, 'Message long enough to pass.', 'accepted'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c4', 550, 'Message long enough to pass.', 'declined'),
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4', 550, 'Message long enough to pass.', 'declined'),

  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c5', 700, 'Message long enough to pass.', 'declined'),
  ('10000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c5', 700, 'Message long enough to pass.', 'declined'),
  ('10000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c5', 700, 'Message long enough to pass.', 'declined');

-- ── 1: free caller → NULL ────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is(
  (select platform_median_acceptance_rate()),
  null::numeric,
  'a free-tier caller gets NULL from platform_median_acceptance_rate'
);
reset role;

-- ── 2: standard caller → NULL ────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is(
  (select platform_median_acceptance_rate()),
  null::numeric,
  'a standard-tier caller gets NULL from platform_median_acceptance_rate'
);
reset role;

-- ── 3: premium caller → NOT NULL, numeric in [0,1] ───────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select ok(
  (select platform_median_acceptance_rate()) is not null,
  'a premium-tier caller gets a non-null median acceptance rate'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select ok(
  (select platform_median_acceptance_rate() between 0 and 1),
  'the median acceptance rate is a value in [0,1]'
);
reset role;

select * from finish();
rollback;
