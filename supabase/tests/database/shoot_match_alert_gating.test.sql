-- shoot_match_alert_gating: the instant shoot_match EMAIL is gated to
-- standard/premium photographers (via photographer_effective_tier, never raw
-- plan_tier — see 20260707000000_subscriptions.sql's "anti-drift" comment).
-- The in-app `notifications` bell stays UNGATED for every tier — free and
-- basic photographers still get the bell, they just don't get the instant
-- email (basic gets a once-daily digest instead, covered by the pure
-- photographerMatchesShoot matcher + zurich.test.ts, not pgTAP).
--
-- Seeds five photographers, all matching the posted shoot's canton+discipline,
-- differing ONLY by effective tier (which the view derives from
-- plan_tier + plan_expires_at):
--   d2 basic,   active (future expiry)   -> bell yes, email NO
--   d3 standard active (future expiry)   -> bell yes, email YES
--   d4 standard EXPIRED (past expiry)    -> effective 'free' -> bell yes, email NO
--   d5 premium, active (future expiry)   -> bell yes, email YES
--   d6 free (no plan at all)             -> bell yes, email NO
begin;
create extension if not exists pgtap;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  -- client posting the shoot
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smg-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"SMG Client"}', now(), now()),
  -- basic tier
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smg-basic@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Basic Photographer"}', now(), now()),
  -- standard tier, active
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smg-std@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Standard Photographer"}', now(), now()),
  -- standard tier, expired -> effective free
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smg-expired@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Expired Standard Photographer"}', now(), now()),
  -- premium tier, active
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smg-premium@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Premium Photographer"}', now(), now()),
  -- free tier (no plan at all)
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'smg-free@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Free Photographer"}', now(), now());

insert into public.photographer_details
  (profile_id, coverage_cantons, disciplines, plan_tier, plan_expires_at)
values
  ('00000000-0000-0000-0000-0000000000d2', array['BE']::public.canton[], array['photo']::public.discipline[],
   'basic', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000d3', array['BE']::public.canton[], array['photo']::public.discipline[],
   'standard', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000d4', array['BE']::public.canton[], array['photo']::public.discipline[],
   'standard', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d5', array['BE']::public.canton[], array['photo']::public.discipline[],
   'premium', now() + interval '30 days'),
  ('00000000-0000-0000-0000-0000000000d6', array['BE']::public.canton[], array['photo']::public.discipline[],
   'free', null);

-- Act as the client posting a new open shoot: canton BE, discipline photo.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';

insert into public.shoots (id, client_id, title, type, discipline, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1',
   'Gating alert shoot', 'portrait', 'photo', 'A brief long enough to pass validation.', 'Bern', 'BE',
   '2027-09-01', 2, 500, 900);

-- Read email_outbox/notifications as postgres (service-role only / RLS-protected).
reset role;

-- sanity: the view resolves the intended effective tiers before asserting on
-- the trigger's behavior, so a failure here points at the fixture, not the gate.
select is(
  (select effective_tier from public.photographer_effective_tier
     where profile_id = '00000000-0000-0000-0000-0000000000d4'),
  'free',
  'sanity: the expired standard photographer reads back as effective free'
);

-- 1-2: basic tier -> bell yes, instant email no
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000d2'
     and type = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'basic tier photographer receives the in-app bell'
);
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000d2'
     and kind = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  0, 'basic tier photographer does NOT receive the instant email'
);

-- 3-4: standard tier (active) -> bell yes, instant email yes
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000d3'
     and type = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'active standard tier photographer receives the in-app bell'
);
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000d3'
     and kind = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'active standard tier photographer receives the instant email'
);

-- 5-6: standard tier (expired -> effective free) -> bell yes, instant email no
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000d4'
     and type = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'expired standard tier photographer still receives the in-app bell'
);
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000d4'
     and kind = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  0, 'expired standard tier photographer does NOT receive the instant email'
);

-- 7-8: premium tier (active) -> bell yes, instant email yes
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000d5'
     and type = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'active premium tier photographer receives the in-app bell'
);
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000d5'
     and kind = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'active premium tier photographer receives the instant email'
);

-- 9-10: free tier (no plan) -> bell yes, instant email no
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000d6'
     and type = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  1, 'free tier photographer still receives the in-app bell'
);
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000d6'
     and kind = 'shoot_match' and shoot_id = '10000000-0000-0000-0000-0000000000d1'),
  0, 'free tier photographer does NOT receive the instant email'
);

select * from finish();
rollback;
