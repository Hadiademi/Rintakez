-- shoot_match_alerts: posting a new OPEN shoot enqueues a shoot_match email for
-- every photographer whose coverage canton + discipline match, respecting
-- notify_shoot_updates and excluding the poster. It also creates an in-app
-- `notifications` row (type 'shoot_match') for the same match set, and
-- re-fires the whole fan-out when an assigned shoot reopens (the
-- booking_integrity orphan-reopen path). email_outbox and notifications are
-- both insert-only for authenticated users, so assertions read them via
-- `reset role` (postgres bypasses RLS), then re-authenticate for any further
-- RLS-scoped actions (idiom from rls.test.sql).
begin;
create extension if not exists pgtap;

select plan(8);

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

-- 6: the matching photographer also gets an in-app notifications row
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000e2'
     and type = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e1'),
  1,
  'the matching photographer receives an in-app shoot_match notification'
);

-- ── reopen: a shoot flipping assigned -> open re-enqueues the fan-out ──
-- Act as the client again, post a second shoot, assign+accept a bid from the
-- matching photographer, then delete that bid so the booking_integrity
-- orphan-reopen trigger flips the shoot back to 'open'. That reopen should
-- re-run notify_matching_photographers and enqueue a second round of alerts.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

insert into public.shoots (id, client_id, title, type, discipline, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1',
   'Reopen alert shoot', 'portrait', 'photo', 'A brief long enough to pass validation.', 'Bern', 'BE',
   '2027-09-02', 2, 500, 900);

-- Switch to the matching photographer to place their own bid (bids RLS
-- requires photographer_id = auth.uid() on insert).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000e2', '10000000-0000-0000-0000-0000000000e2',
   '00000000-0000-0000-0000-0000000000e2', 700, 'Bid to be accepted then orphaned.');

reset role;

-- Assign the shoot via the legal open->assigned transition (bypassing RLS as
-- the test superuser, same idiom as constraints.test.sql).
update public.shoots
  set status = 'assigned',
      accepted_bid_id = '20000000-0000-0000-0000-0000000000e2'
  where id = '10000000-0000-0000-0000-0000000000e2';

-- Deleting the accepted bid orphans the booking: reopen_orphaned_shoot()
-- flips the shoot back to 'open', which should re-fire the match fan-out.
delete from public.bids where id = '20000000-0000-0000-0000-0000000000e2';

-- 7: reopening the shoot re-enqueues a shoot_match email
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000e2'
     and kind = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e2'),
  1,
  'reopening an assigned shoot re-enqueues a shoot_match email'
);

-- 8: reopening the shoot re-inserts an in-app shoot_match notification
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000e2'
     and type = 'shoot_match'
     and shoot_id = '10000000-0000-0000-0000-0000000000e2'),
  1,
  'reopening an assigned shoot re-inserts an in-app shoot_match notification'
);

select * from finish();
rollback;
