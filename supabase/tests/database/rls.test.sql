begin;
create extension if not exists pgtap;

select plan(28);

-- ── fixtures: 1 client + 2 photographers (trigger creates profiles) ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Lena K."}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marko@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Marko B."}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'anna@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Anna S."}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Hochzeit in Zermatt', 'wedding', 'Dokumentarischer Stil, Bergkapelle.',
   'Zermatt', 'VS', '2027-08-14', 10, 3200, 4500);

-- A cancelled shoot that must be invisible to others
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, status)
values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Abgesagter Termin', 'portrait', 'Wird nicht stattfinden.',
   'Bern', 'BE', '2027-09-01', 2, 500, 800, 'cancelled');

-- A third open shoot used for status-transition and bid-immutability tests,
-- so the accept_bid happy-path block (tests 13-16) is not disturbed.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Portrait in Basel', 'portrait', 'Modernes Businessportrait im Studio.',
   'Basel', 'BS', '2027-10-01', 3, 600, 1000);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002', 3800, 'Ruhiger dokumentarischer Stil.'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003', 4200, 'Editorial und ehrlich.');

-- Bid on the third shoot for the shoot_id immutability test.
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000002', 700, 'Businessportrait, gerne.');

-- A dedicated open shoot + bid for the decline_bid tests, decoupled from the
-- accept_bid happy-path fixtures so ordering does not matter.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('19000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001',
   'Familienshooting Luzern', 'family', 'Lockeres Shooting am See.',
   'Luzern', 'LU', '2027-11-01', 2, 400, 700);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('29000000-0000-0000-0000-000000000009', '19000000-0000-0000-0000-000000000009',
   '00000000-0000-0000-0000-000000000002', 550, 'Natürliche Familienfotos.');

-- ── 1–5: tables exist ────────────────────────────────────────────────
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'photographer_details', 'photographer_details exists');
select has_table('public', 'portfolio_images', 'portfolio_images exists');
select has_table('public', 'shoots', 'shoots exists');
select has_table('public', 'bids', 'bids exists');

-- ── 6: anon sees only open shoots ────────────────────────────────────
-- Scoped to fixture rows (id like '10000000-%') so seed data cannot affect this.
-- Fixture shoots: 1...01 (open), 1...02 (cancelled), 1...03 (open) → anon sees 2.
set local role anon;
select results_eq(
  $$select count(*)::int from public.shoots where id::text like '10000000-%'$$,
  array[2],
  'anon sees only the open fixture shoots (1 and 3), not the cancelled one'
);
reset role;

-- ── 7: photographer Anna cannot see Markos bid ──────────────────────
-- Scoped to fixture bids (shoot_id like '10000000-%') so seed data cannot affect this.
-- Anna has 1 fixture bid (bid 2 on shoot 1); she cannot see Marko's bids.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids where shoot_id::text like '10000000-%'$$,
  array[1],
  'photographer sees only her own fixture bid'
);
reset role;

-- ── 8: client sees both bids on own shoot ────────────────────────────
-- Scoped to fixture bids (shoot_id like '10000000-%') so seed data cannot affect this.
-- Client owns all 3 fixture shoots → sees all 3 fixture bids (bid 1, 2, 3).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.bids where shoot_id::text like '10000000-%'$$,
  array[3],
  'client sees all fixture bids on own shoots'
);

-- ── 9: client cannot insert a bid (wrong role) ──────────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001', 1000, 'Ich biete mit.')$$,
  '42501',
  null,
  'client role cannot bid'
);
reset role;

-- ── 10: photographer cannot bid on a non-open shoot ─────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000002', 600, 'Biete trotzdem.')$$,
  '42501',
  null,
  'cannot bid on cancelled shoot'
);

-- ── 11: duplicate bid blocked by unique constraint ───────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', 3900, 'Zweites Angebot.')$$,
  '23505',
  null,
  'one bid per photographer per shoot'
);

-- ── 12: photographer cannot accept a bid ─────────────────────────────
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not your shoot',
  'only the shoot client can accept'
);
reset role;

-- ── 13–16: owner accepts → full state transition ─────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-000000000001')$$,
  'client accepts Markos bid'
);

select results_eq(
  $$select status::text from public.bids where id = '20000000-0000-0000-0000-000000000001'$$,
  array['accepted'],
  'accepted bid is accepted'
);

select results_eq(
  $$select status::text from public.bids where id = '20000000-0000-0000-0000-000000000002'$$,
  array['declined'],
  'sibling pending bid auto-declined'
);

select results_eq(
  $$select status::text || ':' || accepted_bid_id::text
    from public.shoots where id = '10000000-0000-0000-0000-000000000001'$$,
  array['assigned:20000000-0000-0000-0000-000000000001'],
  'shoot assigned with accepted_bid_id set'
);

-- ── 17: get_counterparty_email returns photographer email to client ───
-- Shoot 1 is now assigned to Marko (00...0002 / marko@test.ch).
-- The client calls the function and should get Marko's email.
select results_eq(
  $$select public.get_counterparty_email('10000000-0000-0000-0000-000000000001')$$,
  array['marko@test.ch'],
  'client gets photographer email on assigned shoot'
);

-- ── 18: get_counterparty_email throws for unrelated party ────────────
-- Shoot 3 is still open; client is still logged in but shoot 3 has no
-- accepted bid, so the function raises 'no contact available'.
select throws_ok(
  $$select public.get_counterparty_email('10000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'no contact available',
  'get_counterparty_email throws for shoot with no accepted bid'
);
reset role;

-- ── 19: client cannot update own role ────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$update public.profiles set role = 'photographer'
    where id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'client cannot change own role'
);
reset role;

-- ── 20: anon cannot INSERT into shoots ───────────────────────────────
set local role anon;
select throws_ok(
  $$insert into public.shoots (client_id, title, type, brief, location_city,
                               canton, shoot_date, duration_hours,
                               budget_min_chf, budget_max_chf)
    values ('00000000-0000-0000-0000-000000000001',
            'Anon shoot', 'portrait', 'Should be rejected by RLS.',
            'Zurich', 'ZH', '2028-01-01', 2, 100, 200)$$,
  '42501',
  null,
  'anon cannot insert shoots'
);

-- ── 21: anon cannot INSERT into bids ─────────────────────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000002', 500, 'Anon bid.')$$,
  '42501',
  null,
  'anon cannot insert bids'
);
reset role;

-- ── 22: trigger blocks assigned→open directly (bypassing RLS with postgres role) ──
-- Shoot 1 is assigned after test 13. Using the postgres superuser role bypasses RLS
-- so we hit the trigger directly. assigned->open is explicitly forbidden by the FSM.
select throws_ok(
  $$update public.shoots set status = 'open'
    where id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001',
  'illegal shoot status transition',
  'trigger blocks assigned->open (postgres role, no RLS)'
);

-- ── 23: client cannot re-open an assigned shoot ───────────────────────
-- Shoot 1 is now assigned (after test 13). Trying to set it back to 'open'
-- is blocked by the status-guard trigger (assigned->open is forbidden).
-- USING admits assigned shoots, WITH CHECK admits 'open', but the BEFORE trigger
-- fires first and raises 'illegal shoot status transition'.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$update public.shoots set status = 'open'
    where id = '10000000-0000-0000-0000-000000000001'$$,
  'P0001',
  null,
  'client cannot re-open an assigned shoot'
);
reset role;

-- ── 24: photographer cannot move bid to a different shoot ─────────────
-- Marko (00...0002) tries to move bid 3 (on shoot 3) to shoot 1.
-- The trigger must block the shoot_id change.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$update public.bids set shoot_id = '10000000-0000-0000-0000-000000000001'
    where id = '20000000-0000-0000-0000-000000000003'$$,
  'P0001',
  null,
  'photographer cannot change shoot_id on own bid'
);
reset role;

-- ── 25: accept_bid is NOT executable by anon ─────────────────────────
select is(
  has_function_privilege('anon', 'public.accept_bid(uuid)', 'execute'),
  false,
  'anon cannot execute accept_bid'
);

-- ── 26: non-owner photographer cannot decline a bid ──────────────────
-- Marko (00...0002) is the bidder but NOT the shoot owner; decline_bid must
-- reject him with 'not your shoot'.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.decline_bid('29000000-0000-0000-0000-000000000009')$$,
  'P0001',
  'not your shoot',
  'non-owner cannot decline a bid'
);
reset role;

-- ── 27–28: owner declines a pending bid on own open shoot ────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.decline_bid('29000000-0000-0000-0000-000000000009')$$,
  'owner declines a pending bid'
);
select results_eq(
  $$select status::text from public.bids where id = '29000000-0000-0000-0000-000000000009'$$,
  array['declined'],
  'declined bid is declined'
);
reset role;

select * from finish();
rollback;
