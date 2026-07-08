-- Moderation enforcement from 20260622010000_moderation.sql (gap A1).
-- Verifies that suspended users cannot create content, that accept_bid refuses a
-- suspended client, and that suspended shoots disappear from the public browse —
-- while non-suspended users are unaffected.
begin;
create extension if not exists pgtap;

select plan(8);

-- ── fixtures: 1 client + 2 photographers + 3 shoots + 1 conversation ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'modc1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Mod Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'modf1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Mod Photographer One"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'modf2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Mod Photographer Two"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, is_suspended)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1',
   'Open shoot', 'portrait', 'A normal open shoot.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900, false),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1',
   'Suspended shoot', 'portrait', 'A suspended open shoot.', 'Bern', 'BE',
   '2027-12-02', 2, 500, 900, true),
  ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c1',
   'Accept-test shoot', 'portrait', 'For the accept_bid suspension test.',
   'Bern', 'BE', '2027-12-03', 2, 500, 900, false);

-- A pending bid (from F2) on S3, used by the accept_bid suspension test.
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000b3', '10000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-0000000000f2', 800, 'Pending bid for accept test.');

-- A conversation between the client and F1 (for the message test).
insert into public.conversations (id, shoot_id, client_id, photographer_id)
values
  ('30000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1');

-- ── 1: control — a NON-suspended photographer can bid on an open shoot ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select lives_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000f2', 700, 'Happy path bid.')$$,
  'a non-suspended photographer can bid on an open shoot'
);
reset role;

-- Suspend photographer F1.
update public.profiles set is_suspended = true
  where id = '00000000-0000-0000-0000-0000000000f1';

-- ── 2: a SUSPENDED photographer cannot bid ───────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000f1', 700, 'Should be blocked.')$$,
  '42501',
  null,
  'a suspended photographer cannot insert a bid'
);
reset role;

-- ── 3: nobody can bid on a SUSPENDED shoot ───────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-0000000000a2',
            '00000000-0000-0000-0000-0000000000f2', 700, 'Bid on suspended shoot.')$$,
  '42501',
  null,
  'no one can bid on a suspended shoot'
);

-- ── 4 + 5: a suspended shoot is hidden from the public browse ─────────
select results_eq(
  $$select count(*)::int from public.shoots
      where id = '10000000-0000-0000-0000-0000000000a2'$$,
  array[0],
  'a suspended shoot is not visible to a non-owner photographer'
);
select results_eq(
  $$select count(*)::int from public.shoots
      where id = '10000000-0000-0000-0000-0000000000a1'$$,
  array[1],
  'a normal open shoot is still visible to a photographer'
);
reset role;

-- ── 6: a SUSPENDED user cannot send a message ────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('30000000-0000-0000-0000-0000000000d1',
            '00000000-0000-0000-0000-0000000000f1', 'Should be blocked.')$$,
  '42501',
  null,
  'a suspended user cannot insert a message'
);
reset role;

-- Suspend the client.
update public.profiles set is_suspended = true
  where id = '00000000-0000-0000-0000-0000000000c1';

-- ── 7: a SUSPENDED client cannot accept a bid ────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000b3')$$,
  'P0001',
  'account suspended',
  'a suspended client cannot accept a bid'
);

-- ── 8: a SUSPENDED client cannot post a shoot ────────────────────────
select throws_ok(
  $$insert into public.shoots (client_id, title, type, brief, location_city,
                               canton, shoot_date, duration_hours,
                               budget_min_chf, budget_max_chf)
    values ('00000000-0000-0000-0000-0000000000c1', 'New shoot', 'portrait',
            'Brief that is long enough.', 'Bern', 'BE', '2027-12-09', 2,
            500, 900)$$,
  '42501',
  null,
  'a suspended client cannot insert a shoot'
);
reset role;

select * from finish();
rollback;
