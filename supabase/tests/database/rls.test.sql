begin;
create extension if not exists pgtap;

select plan(73);

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

-- ── 29: shoot_images table exists ────────────────────────────────────
select has_table('public', 'shoot_images', 'shoot_images exists');

-- Owner (client) attaches reference images. Shoot 3 is open, shoot 2 is the
-- cancelled shoot — the owner may attach to either (status-agnostic insert).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ── 30: owner inserts an image on own open shoot ─────────────────────
select lives_ok(
  $$insert into public.shoot_images (id, shoot_id, storage_path)
    values ('30000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000003/a.jpg')$$,
  'owner attaches a reference image to own open shoot'
);

-- ── 31: owner inserts an image on own cancelled shoot ────────────────
select lives_ok(
  $$insert into public.shoot_images (id, shoot_id, storage_path)
    values ('30000000-0000-0000-0000-000000000002',
            '10000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000002/b.jpg')$$,
  'owner attaches a reference image to own cancelled shoot'
);
reset role;

-- ── 32–33: anon sees images on open shoots, not on cancelled ones ────
-- `reset role` does not clear the JWT claims GUC, so blank it explicitly —
-- otherwise auth.uid() would still resolve to the previous client.
set local role anon;
set local request.jwt.claims to '';
select results_eq(
  $$select count(*)::int from public.shoot_images
    where shoot_id = '10000000-0000-0000-0000-000000000003'$$,
  array[1],
  'anon sees reference images on an open shoot'
);
select results_eq(
  $$select count(*)::int from public.shoot_images
    where shoot_id = '10000000-0000-0000-0000-000000000002'$$,
  array[0],
  'anon cannot see reference images on a cancelled shoot'
);

-- ── 34: anon cannot insert a shoot image ─────────────────────────────
select throws_ok(
  $$insert into public.shoot_images (shoot_id, storage_path)
    values ('10000000-0000-0000-0000-000000000003', 'x/y/z.jpg')$$,
  '42501',
  null,
  'anon cannot insert shoot images'
);
reset role;

-- ── 35: non-owner photographer cannot insert a shoot image ───────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into public.shoot_images (shoot_id, storage_path)
    values ('10000000-0000-0000-0000-000000000003',
            '00000000-0000-0000-0000-000000000002/x.jpg')$$,
  '42501',
  null,
  'non-owner photographer cannot attach images to a shoot'
);

-- ── 36–37: non-owner delete is a no-op (RLS filters the row out) ──────
select lives_ok(
  $$delete from public.shoot_images
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'non-owner delete runs but affects no rows'
);
select results_eq(
  $$select count(*)::int from public.shoot_images
    where id = '30000000-0000-0000-0000-000000000001'$$,
  array[1],
  'owner image survives a non-owner delete attempt'
);
reset role;

-- ── 38–39: owner deletes own image ───────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$delete from public.shoot_images
    where id = '30000000-0000-0000-0000-000000000001'$$,
  'owner deletes own reference image'
);
select results_eq(
  $$select count(*)::int from public.shoot_images
    where id = '30000000-0000-0000-0000-000000000001'$$,
  array[0],
  'deleted reference image is gone'
);
reset role;

-- ── 40: notifications table exists ───────────────────────────────────
select has_table('public', 'notifications', 'notifications exists');

-- Fixtures inserted 4 bids on client-01's shoots → 4 bid_received rows.
-- Test 13 accepted bid 1 → Marko bid_accepted + Anna bid_declined (sibling).
-- Test 27 declined bid 9 → Marko bid_declined.

-- ── 41: client sees own bid_received notifications ───────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.notifications
    where user_id = auth.uid() and type = 'bid_received'$$,
  array[4],
  'client sees a bid_received notification for each incoming bid'
);
reset role;

-- ── 42–43: photographer isolation + own accepted notification ────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.notifications where type = 'bid_received'$$,
  array[0],
  'photographer cannot see the client''s bid_received notifications'
);
select results_eq(
  $$select count(*)::int from public.notifications
    where user_id = auth.uid() and type = 'bid_accepted'$$,
  array[1],
  'photographer is notified when their bid is accepted'
);
reset role;

-- ── 44: sibling photographer gets a declined notification ────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.notifications
    where user_id = auth.uid() and type = 'bid_declined'$$,
  array[1],
  'auto-declined photographer is notified'
);
reset role;

-- ── 45–46: a user may mark only their own notifications read ─────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$update public.notifications set read_at = now() where user_id = auth.uid()$$,
  'photographer marks own notifications read'
);
select results_eq(
  $$select count(*)::int from public.notifications
    where user_id = auth.uid() and read_at is null$$,
  array[0],
  'all of the photographer''s notifications are now read'
);
-- Attempt to touch everyone else's notifications — RLS filters them out.
update public.notifications set read_at = now();
reset role;

-- ── 47: the other user's notifications were untouched ────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.notifications
    where user_id = auth.uid() and read_at is null$$,
  array[4],
  'one user cannot mark another user''s notifications read'
);
reset role;

-- ── 48: non-owner cannot complete a shoot ────────────────────────────
-- Shoot 1 is assigned to Marko. Marko (the photographer) is not the client.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.complete_shoot('10000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'cannot complete shoot',
  'only the shoot client can complete it'
);
reset role;

-- ── 49: owner completes the assigned shoot ───────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select public.complete_shoot('10000000-0000-0000-0000-000000000001')$$,
  'client completes own assigned shoot'
);
reset role;

-- ── 50: reviews table exists ─────────────────────────────────────────
select has_table('public', 'reviews', 'reviews exists');

-- ── 51: a photographer cannot leave a review ─────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000002', 5)$$,
  '42501',
  null,
  'a photographer cannot review'
);
reset role;

-- ── 52: review must name the photographer who was actually assigned ──
-- Shoot 1 was assigned to Marko (02); a review naming Anna (03) is rejected.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000003', 5)$$,
  '42501',
  null,
  'review must reference the assigned photographer'
);

-- ── 53: owner leaves a valid review ──────────────────────────────────
select lives_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating, comment)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', 5, 'Hervorragende Arbeit.')$$,
  'client reviews the assigned photographer on a completed shoot'
);

-- ── 54: only one review per shoot ────────────────────────────────────
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', 4)$$,
  '23505',
  null,
  'one review per shoot'
);
reset role;

-- ── 55: rating aggregate view reflects the review ────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select review_count from public.photographer_ratings
    where photographer_id = '00000000-0000-0000-0000-000000000002'$$,
  array[1],
  'photographer_ratings view counts the review'
);
reset role;

-- ── 56–58: set_initial_role (Google sign-in role assignment) ─────────
-- A fresh OAuth-style user: no role in metadata → role_confirmed = false.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'oauth@test.ch',
   extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"full_name":"OAuth User"}', now(), now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
select lives_ok(
  $$select public.set_initial_role('photographer')$$,
  'fresh OAuth user can claim a role'
);
select results_eq(
  $$select role::text from public.profiles
    where id = '00000000-0000-0000-0000-0000000000aa'$$,
  array['photographer'],
  'OAuth user role is set to the chosen role'
);
reset role;

-- A confirmed user cannot flip their role via set_initial_role (no-op).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select set_initial_role('photographer');
select results_eq(
  $$select role::text from public.profiles
    where id = '00000000-0000-0000-0000-000000000001'$$,
  array['client'],
  'set_initial_role is a no-op once the role is confirmed'
);
reset role;

-- ── 59–67: messaging ─────────────────────────────────────────────────
-- Shoot 1 was assigned (test 13) → a conversation was auto-created between the
-- client (01) and the accepted photographer Marko (02).
select has_table('public', 'conversations', 'conversations exists');
select has_table('public', 'messages', 'messages exists');

-- 61: the client sees the conversation for the assigned shoot.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.conversations
    where shoot_id = '10000000-0000-0000-0000-000000000001'$$,
  array[1],
  'conversation auto-created on assignment, visible to the client'
);
reset role;

-- 62: an unrelated photographer (Anna) sees no conversations.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.conversations$$,
  array[0],
  'non-participant cannot see the conversation'
);
reset role;

-- 63: the client (participant) posts a message.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations
             where shoot_id = '10000000-0000-0000-0000-000000000001'),
            '00000000-0000-0000-0000-000000000001', 'Hallo, freue mich!')$$,
  'client can post in the conversation'
);
reset role;

-- 64: the photographer (participant) posts a message.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations
             where shoot_id = '10000000-0000-0000-0000-000000000001'),
            '00000000-0000-0000-0000-000000000002', 'Danke, bis bald!')$$,
  'accepted photographer can post in the conversation'
);
reset role;

-- 65: a non-participant cannot post (sees no conversation → cannot target it).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations
             where shoot_id = '10000000-0000-0000-0000-000000000001'),
            '00000000-0000-0000-0000-000000000003', 'Darf ich nicht.')$$,
  null,
  null,
  'non-participant cannot post a message'
);
-- 66: and cannot read the messages either.
select results_eq(
  $$select count(*)::int from public.messages$$,
  array[0],
  'non-participant cannot read the conversation messages'
);
reset role;

-- 67: the client sees both messages.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.messages$$,
  array[2],
  'participant sees all messages in the conversation'
);
reset role;

-- ── 68: cancelling an assigned booking notifies the photographer ─────
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('18000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001',
   'Bald abgesagt', 'event', 'Wird zugewiesen und dann abgesagt.',
   'Bern', 'BE', '2027-12-01', 3, 500, 900);
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('28000000-0000-0000-0000-000000000008', '18000000-0000-0000-0000-000000000008',
   '00000000-0000-0000-0000-000000000002', 700, 'Mache ich gerne.');
-- assign (postgres role bypasses RLS for the setup)
update public.shoots
  set status = 'assigned', accepted_bid_id = '28000000-0000-0000-0000-000000000008'
  where id = '18000000-0000-0000-0000-000000000008';

-- client cancels the assigned shoot
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
update public.shoots set status = 'cancelled'
  where id = '18000000-0000-0000-0000-000000000008';
reset role;

-- the assigned photographer is notified
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.notifications
    where user_id = auth.uid() and type = 'shoot_cancelled'$$,
  array[1],
  'cancelling an assigned shoot notifies the photographer'
);
reset role;

-- ── 69–72: moderation reports ────────────────────────────────────────
select has_table('public', 'reports', 'reports exists');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
-- 70: a user files a report under their own id.
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-000000000002', 'profile',
            '00000000-0000-0000-0000-000000000001', 'Unangemessenes Verhalten.')$$,
  'a user can file a report'
);
-- 71: but cannot file one under someone else's id.
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-000000000001', 'profile',
            '00000000-0000-0000-0000-000000000003', 'Spoofed reporter.')$$,
  '42501',
  null,
  'cannot file a report as another user'
);
reset role;

-- 72: a different user cannot see that report.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.reports$$,
  array[0],
  'reports are private to their reporter'
);
reset role;

-- ── 73: a user cannot self-promote to admin ──────────────────────────
-- is_admin is excluded from the column-level UPDATE grant, so this is denied.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$update public.profiles set is_admin = true
    where id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'a user cannot grant themselves admin'
);
reset role;

select * from finish();
rollback;
