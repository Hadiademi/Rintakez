-- shoot_match_alerts: posting a new OPEN shoot enqueues a shoot_match email for
-- every photographer whose coverage canton + discipline match, respecting
-- notify_shoot_updates and excluding the poster. email_outbox is service-role
-- only, so assertions read it via `reset role` (postgres bypasses RLS), then
-- re-authenticate for any further RLS-scoped actions (idiom from rls.test.sql).
begin;
create extension if not exists pgtap;

select plan(5);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  -- client posting the shoot
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sma-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"SMA Client"}', now(), now()),
  -- matching photographer: BE canton, photo discipline, notifications on
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sma-match@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Match Photographer"}', now(), now()),
  -- wrong canton: covers ZH only
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sma-canton@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Wrong Canton Photographer"}', now(), now()),
  -- wrong discipline: video only
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sma-disc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Wrong Discipline Photographer"}', now(), now()),
  -- matches coverage + discipline but opted out of shoot-update emails
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sma-optout@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Opted Out Photographer"}', now(), now());

update public.profiles set notify_shoot_updates = false
  where id = '00000000-0000-0000-0000-0000000000e5';

insert into public.photographer_details (profile_id, coverage_cantons, disciplines)
values
  ('00000000-0000-0000-0000-0000000000e2', array['BE']::public.canton[], array['photo']::public.discipline[]),
  ('00000000-0000-0000-0000-0000000000e3', array['ZH']::public.canton[], array['photo']::public.discipline[]),
  ('00000000-0000-0000-0000-0000000000e4', array['BE']::public.canton[], array['video']::public.discipline[]),
  ('00000000-0000-0000-0000-0000000000e5', array['BE']::public.canton[], array['photo']::public.discipline[]);

-- Act as the client posting a new open shoot: canton BE, discipline photo.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

insert into public.shoots (id, client_id, title, type, discipline, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
   'Match alert shoot', 'portrait', 'photo', 'A brief long enough to pass validation.', 'Bern', 'BE',
   '2027-09-01', 2, 500, 900);

-- Read email_outbox as postgres (service-role only / RLS-protected from authenticated).
reset role;

-- 1: the matching photographer got a shoot_match email enqueued
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000e2'
     and kind = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e1'),
  1,
  'the matching photographer receives a shoot_match email'
);

-- 2: shoot_title is carried on the outbox row
select is(
  (select shoot_title from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000e2'
     and kind = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e1'),
  'Match alert shoot',
  'the outbox row carries the shoot title'
);

-- 3: no row for the photographer covering a different canton
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000e3'
     and kind = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e1'),
  0,
  'no email for a photographer in a different canton'
);

-- 4: no row for the photographer with the wrong discipline
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000e4'
     and kind = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e1'),
  0,
  'no email for a photographer with the wrong discipline'
);

-- 5: no row for a matching photographer who opted out of shoot-update emails
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000e5'
     and kind = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e1'),
  0,
  'no email for a matching photographer who opted out of shoot-update emails'
);

select * from finish();
rollback;
