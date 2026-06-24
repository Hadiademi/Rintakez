-- accept_bid hardening from 20260624010000_accept_bid_hardening.sql:
-- acceptance refuses a discipline mismatch, a suspended photographer, and a
-- suspended shoot, and otherwise succeeds and assigns the shoot.
begin;
create extension if not exists pgtap;

select plan(5);

-- 1 client + 3 photographers (a photo pro, a video pro, a suspended photo pro).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ab-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"AB Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ab-photo@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"AB Photo"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ab-susp@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"AB Suspended"}', now(), now());

insert into public.photographer_details (profile_id, disciplines) values
  ('00000000-0000-0000-0000-0000000000a2', '{photo}'),
  ('00000000-0000-0000-0000-0000000000a4', '{photo}');

update public.profiles set is_suspended = true
  where id = '00000000-0000-0000-0000-0000000000a4';

-- Shoots (all owned by the client): a photo shoot, a video shoot, a photo shoot
-- for the suspended-photographer test, and a suspended photo shoot.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, discipline, is_suspended)
values
  ('10000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1',
   'Photo shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-01', 2, 500, 900, 'photo', false),
  ('10000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a1',
   'Video shoot', 'event', 'Brief long enough.', 'Bern', 'BE', '2027-12-01', 2, 500, 900, 'video', false),
  ('10000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-0000000000a1',
   'Photo shoot 2', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-01', 2, 500, 900, 'photo', false),
  ('10000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000a1',
   'Suspended shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE', '2027-12-01', 2, 500, 900, 'photo', true);

-- Bids (inserted as postgres, bypassing RLS).
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a5',
   '00000000-0000-0000-0000-0000000000a2', 700, 'Photo pro on photo shoot.'),
  ('20000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a6',
   '00000000-0000-0000-0000-0000000000a2', 700, 'Photo pro on video shoot.'),
  ('20000000-0000-0000-0000-0000000000a7', '10000000-0000-0000-0000-0000000000a7',
   '00000000-0000-0000-0000-0000000000a4', 700, 'Suspended pro.'),
  ('20000000-0000-0000-0000-0000000000a8', '10000000-0000-0000-0000-0000000000a8',
   '00000000-0000-0000-0000-0000000000a2', 700, 'Bid on suspended shoot.');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

-- 1: a photo-only photographer cannot be awarded a video shoot.
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000a6')$$,
  'P0001', null, 'accept_bid refuses a discipline mismatch'
);

-- 2: a suspended photographer cannot be awarded a shoot.
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000a7')$$,
  'P0001', null, 'accept_bid refuses a suspended photographer'
);

-- 3: a suspended shoot cannot have a bid accepted.
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000a8')$$,
  'P0001', null, 'accept_bid refuses a suspended shoot'
);

-- 4: a matching, non-suspended acceptance succeeds.
select lives_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-0000000000a5')$$,
  'accept_bid accepts a matching, non-suspended bid'
);

reset role;

-- 5: the shoot is now assigned.
select is(
  (select status::text from public.shoots
     where id = '10000000-0000-0000-0000-0000000000a5'),
  'assigned',
  'accepted shoot becomes assigned'
);

select * from finish();
rollback;
