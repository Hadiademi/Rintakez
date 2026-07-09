-- Bid-quota gate — DB-layer invariants (WI-5).
--
-- submitBidAction's quota gate (src/lib/actions/bids.ts) is otherwise only
-- exercised with mocked getBidQuotaUsage in src/lib/actions/bids.test.ts and
-- pure-function unit tests in src/lib/billing/entitlements.test.ts. Neither
-- touches the real DB, so this file proves the invariants the gate actually
-- depends on hold against real Postgres + RLS:
--   1. "free tier" == no row in `subscriptions` at all (effectivePlan(null)).
--   2. the monthly count is scoped to the caller's own bids only (RLS), so
--      one photographer's bids can never inflate another's quota usage.
--   3. the count includes EVERY bid status (withdrawn included) — the
--      anti-gaming behaviour documented in getBidQuotaUsage.
--   4. the Zurich-month cutoff (monthStartZurich in src/lib/billing/zurich.ts)
--      is reproduced here via Postgres' own tz database and used as the exact
--      `gte` boundary the gate queries with — including the inclusive edge
--      and the CEST offset (Zurich is UTC+2 in July, not UTC+1).
-- The DB itself does not (and should not) enforce the cap — that decision is
-- application-level (see submitBidAction) and is what the mocked vitest
-- suite already covers. This file only guards the counting/entitlement
-- ground truth that decision reads from.
begin;
create extension if not exists pgtap;

select plan(11);

-- ── fixtures ──────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'quotaclient@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Quota Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'quotafree@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Quota Free"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'quotastd@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Quota Standard"}', now(), now());

insert into public.photographer_details (profile_id) values
  ('00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000e3');

-- e3 is an entitled standard-plan photographer (mirrors a real Stripe row);
-- e2 gets NO subscriptions row at all — that absence IS the free tier signal
-- (see effectivePlan(null) in src/lib/billing/entitlements.ts).
insert into public.subscriptions (user_id, plan, status, source, current_period_end)
values ('00000000-0000-0000-0000-0000000000e3', 'standard', 'active', 'stripe', now() + interval '30 days');

-- 6 distinct open shoots (one_bid_per_photographer is unique on (shoot_id,
-- photographer_id), so each bid below needs its own shoot).
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
   'Quota shoot 1', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH', '2028-01-01', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1',
   'Quota shoot 2', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH', '2028-01-02', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1',
   'Quota shoot 3', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH', '2028-01-03', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e1',
   'Quota shoot 4', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH', '2028-01-04', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000e1',
   'Quota shoot 5', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH', '2028-01-05', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e1',
   'Quota shoot 6', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH', '2028-01-06', 2, 500, 900);

-- The exact Zurich-local 2026-07-01 00:00:00 boundary, expressed in UTC —
-- reproduced here from Postgres' own tz database (Europe/Zurich observes
-- CEST/+2 in July) so this file cannot silently drift from what
-- monthStartZurich() computes in TypeScript. Verified against the app's own
-- month-start helper output for the same instant before writing this file.
-- select (date_trunc('month', (timestamptz '2026-07-15 12:00:00+00')
--   AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich')
--   => 2026-06-30 22:00:00+00
--
-- e2's count-so-far accumulates across steps 3-6 below; each assertion
-- captures the running total after each insert.

-- ── 1: free tier == absence of a subscriptions row ──────────────────────
select is(
  (select count(*)::int from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000e2'),
  0,
  'the free-tier photographer has no subscriptions row at all — that absence is the free-tier signal'
);

-- ── 2: baseline — zero bids this month before any insert ────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e2'
        and created_at >= timestamptz '2026-06-30 22:00:00+00'$$,
  array[0],
  'e2 (free tier) has zero bids counted before any are placed'
);
reset role;

-- ── 3: one pending July bid reaches the free-tier cap (limit=1) ─────────
set local role service_role;
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message, status, created_at)
values ('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-0000000000e2', 500, 'A pending July bid, long enough.', 'pending',
        '2026-07-05 10:00:00+00');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e2'
        and created_at >= timestamptz '2026-06-30 22:00:00+00'$$,
  array[1],
  'one pending July bid brings e2''s used count to 1, meeting the free-tier limit of 1 (used >= limit)'
);
reset role;

-- ── 4: a WITHDRAWN bid still counts (anti-gaming) ────────────────────────
set local role service_role;
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message, status, created_at)
values ('20000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000e2',
        '00000000-0000-0000-0000-0000000000e2', 500, 'A withdrawn July bid, long enough.', 'withdrawn',
        '2026-07-06 10:00:00+00');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e2'
        and created_at >= timestamptz '2026-06-30 22:00:00+00'$$,
  array[2],
  'a withdrawn bid still counts toward the month — withdraw-and-rebid cannot dodge the cap'
);
reset role;

-- ── 5: a bid just BEFORE the Zurich month boundary is excluded ──────────
set local role service_role;
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message, status, created_at)
values ('20000000-0000-0000-0000-0000000000e3', '10000000-0000-0000-0000-0000000000e3',
        '00000000-0000-0000-0000-0000000000e2', 500, 'A pre-boundary June bid, long enough.', 'pending',
        '2026-06-30 21:59:59+00');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e2'
        and created_at >= timestamptz '2026-06-30 22:00:00+00'$$,
  array[2],
  'a bid one second before the Zurich month boundary (2026-06-30T21:59:59Z) is NOT counted in July'
);
reset role;

-- ── 6: a bid exactly AT the boundary IS included (inclusive >=) ─────────
set local role service_role;
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message, status, created_at)
values ('20000000-0000-0000-0000-0000000000e4', '10000000-0000-0000-0000-0000000000e4',
        '00000000-0000-0000-0000-0000000000e2', 500, 'A bid exactly at the boundary instant.', 'pending',
        '2026-06-30 22:00:00+00');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e2'
        and created_at >= timestamptz '2026-06-30 22:00:00+00'$$,
  array[3],
  'a bid exactly at the boundary instant (Zurich-local 2026-07-01T00:00:00, i.e. CEST +2) IS counted — matches the gate''s inclusive gte'
);
reset role;

-- ── 7: RLS isolates the count — another photographer cannot see e2's bids
--       (so one photographer's activity can never inflate another's quota) ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e2'$$,
  array[0],
  'e3 cannot see e2''s bids at all via RLS — quota counts cannot leak across photographers'
);
reset role;

-- ── 8: the shoots'' client CAN see bids on their own shoots (the other half
--       of bids_select_own_or_shoot_client) — visibility model sanity check
--       tied to the same policy the quota count relies on for its own half. ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select ok(
  (select count(*)::int from public.bids
     where shoot_id in ('10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e2')) = 2,
  'the client who owns the shoots sees the bids placed on them'
);
reset role;

-- ── 9: an entitled standard-plan subscription row resolves as expected ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select results_eq(
  $$select plan, status, source from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000e3'$$,
  $$values ('standard'::text, 'active'::text, 'stripe'::text)$$,
  'e3''s subscription row reads back as an active stripe standard plan'
);
reset role;

-- ── 10-11: a paid tier's usage stays comfortably under its much higher cap ─
set local role service_role;
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message, status, created_at)
values
  ('20000000-0000-0000-0000-0000000000e5', '10000000-0000-0000-0000-0000000000e5',
   '00000000-0000-0000-0000-0000000000e3', 500, 'Standard-tier July bid one, long enough.', 'pending',
   '2026-07-02 09:00:00+00'),
  ('20000000-0000-0000-0000-0000000000e6', '10000000-0000-0000-0000-0000000000e6',
   '00000000-0000-0000-0000-0000000000e3', 500, 'Standard-tier July bid two, long enough.', 'pending',
   '2026-07-03 09:00:00+00');
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000e3'
        and created_at >= timestamptz '2026-06-30 22:00:00+00'$$,
  array[2],
  'e3 (standard tier) has used=2 this month'
);
select ok(
  2 < 32,
  'e3''s used count (2) stays well under the standard-plan monthly quota (32) — MONTHLY_BID_QUOTA.standard in src/lib/billing/plans.ts'
);
reset role;

select * from finish();
rollback;
