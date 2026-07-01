-- accept_bid availability guards from 20260701130000_accept_bid_availability.sql:
-- acceptance refuses a photographer who has blocked the shoot's date
-- (photographer_unavailable), refuses a photographer already assigned to
-- another shoot on the same date, and otherwise succeeds and assigns.
begin;
create extension if not exists pgtap;

select plan(4);

-- 1 client + 2 photographers (both photo pros, one will be double-booked/blocked).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ba-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"BA Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ba-photo@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"BA Photo"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ba-photo2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"BA Photo 2"}', now(), now());

insert into public.photographer_details (profile_id, disciplines) values
  ('00000000-0000-0000-0000-0000000000b2', '{photo}'),
  ('00000000-0000-0000-0000-0000000000b3', '{photo}');

-- b2 has explicitly blocked 2027-12-05.
insert into public.photographer_unavailable (photographer_id, date) values
  ('00000000-0000-0000-0000-0000000000b2', '2027-12-05');

-- Shoots (all owned by the client):
--   b5: on the blocked date, bid from b2 (must be refused).
--   b6/b7: same date 2027-12-06, both biddable by b3 — b6 gets assigned first,
--          then accepting b3's bid on b7 (same date) must be refused.
--   b8: a normal shoot on an unrelated date, bid from b3 (must succeed).
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, discipline, is_suspended)
values
  ('10000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000b1',
   'Blocked-date shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-05', 2, 500, 900, 'photo', false),
  ('10000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-0000000000b1',
   'Double-book shoot A', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-06', 2, 500, 900, 'photo', false),
  ('10000000-0000-0000-0000-0000000000b7', '00000000-0000-0000-0000-0000000000b1',
   'Double-book shoot B', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-06', 2, 500, 900, 'photo', false),
  ('10000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000b1',
   'Normal shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-09', 2, 500, 900, 'photo', false);

-- Bids (inserted as postgres, bypassing RLS).
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000b5', '10000000-0000-0000-0000-0000000000b5',
   '00000000-0000-0000-0000-0000000000b2', 700, 'Blocked photographer bids anyway.'),
  ('20000000-0000-0000-0000-0000000000b6', '10000000-0000-0000-0000-0000000000b6',
   '00000000-0000-0000-0000-0000000000b3', 700, 'First shoot on 12-06.'),
  ('20000000-0000-0000-0000-0000000000b7', '10000000-0000-0000-0000-0000000000b7',
   '00000000-0000-0000-0000-0000000000b3', 700, 'Second shoot on 12-06 (double-book).'),
  ('20000000-0000-0000-0000-0000000000b8', '10000000-0000-0000-0000-0000000000b8',
   '00000000-0000-0000-0000-0000000000b3', 700, 'Normal, available date.');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

-- 1: a photographer who has blocked the shoot's date cannot be awarded it.
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000b5')$$,
  'P0001', null, 'accept_bid refuses a photographer unavailable on the shoot date'
);

-- 2: assign the photographer to the first same-date shoot, so the next
-- acceptance has a real conflicting assignment to detect.
select lives_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000b6')$$,
  'accept_bid accepts the first same-date booking'
);

-- 3: the same photographer cannot also be awarded another shoot on that date.
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000b7')$$,
  'P0001', null, 'accept_bid refuses a photographer already booked on that date'
);

-- 4: an available photographer on an unrelated date is still accepted normally.
select lives_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000b8')$$,
  'accept_bid accepts a matching, available photographer'
);

reset role;

select * from finish();
rollback;
