-- Subscriptions schema + F1/F2 hardening from 20260707000000_subscriptions.sql.
--
-- F1: photographer_details had a table-wide INSERT grant, so a photographer
-- could self-set plan_tier/verification_status on signup/onboarding. The fix
-- column-scopes INSERT to the exact 7 columns the onboarding upsert sends.
-- F2: bids had a table-wide UPDATE grant, so a photographer could backdate
-- created_at to dodge the monthly quota. The fix column-scopes UPDATE to
-- amount_chf/message/status (the only columns app code ever writes).
begin;
create extension if not exists pgtap;

select plan(18);

-- ── fixtures ──────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'subb1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Sub Owner"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'subb2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Sub Other"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'subb3@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Sub Onboarder"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'subb4@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Sub Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'subb5@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Sub Bidder"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b6', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'subb6@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Sub Comp Seed"}', now(), now());

insert into public.subscriptions (user_id, plan, status, source, current_period_end)
values ('00000000-0000-0000-0000-0000000000b1', 'standard', 'active', 'stripe', now() + interval '30 days');

insert into public.photographer_details (profile_id) values
  ('00000000-0000-0000-0000-0000000000b5');

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b4',
   'Sub F2 shoot', 'portrait', 'Brief long enough for the check.', 'Zurich', 'ZH',
   '2028-01-01', 2, 500, 900);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b5', 600, 'Message long enough to pass.');

-- ── 1-3: authenticated has no insert/update/delete on subscriptions ────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok(
  $$insert into public.subscriptions (user_id, plan, status, source, current_period_end)
      values ('00000000-0000-0000-0000-0000000000b1', 'premium', 'active', 'stripe', now() + interval '1 day')$$,
  '42501',
  null,
  'authenticated cannot INSERT into subscriptions'
);
select throws_ok(
  $$update public.subscriptions set plan = 'premium'
      where user_id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501',
  null,
  'authenticated cannot UPDATE subscriptions'
);
select throws_ok(
  $$delete from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501',
  null,
  'authenticated cannot DELETE from subscriptions'
);
reset role;

-- ── 4-6: select is own-row only ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select results_eq(
  $$select plan from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000b1'$$,
  array['standard'],
  'the owner sees their own subscription row'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000b1'$$,
  array[0],
  'another authenticated user cannot see someone else''s subscription row'
);
reset role;

-- anon has no table-level grant at all on subscriptions (only `authenticated`
-- is granted SELECT), so it fails at the privilege check, not via RLS.
set local role anon;
select throws_ok(
  $$select count(*)::int from public.subscriptions where user_id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501',
  null,
  'anon has no SELECT grant on subscriptions at all'
);
reset role;

-- ── 7: F1 — photographer cannot self-set plan_tier via UPDATE ──────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select throws_ok(
  $$update public.photographer_details set plan_tier = 'premium'
      where profile_id = '00000000-0000-0000-0000-0000000000b3'$$,
  '42501',
  null,
  'a photographer cannot directly update their own plan_tier'
);
reset role;

-- ── 8-9: F1 — plan_tier / verification_status excluded from INSERT grant ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select throws_ok(
  $$insert into public.photographer_details
      (profile_id, specialties, disciplines, coverage_cantons, hourly_rate_chf,
       website_url, instagram_url, plan_tier)
    values ('00000000-0000-0000-0000-0000000000b3', '{}', '{photo}', '{}', null, null, null, 'premium')$$,
  '42501',
  null,
  'a photographer cannot INSERT their own row including plan_tier'
);
select throws_ok(
  $$insert into public.photographer_details
      (profile_id, specialties, disciplines, coverage_cantons, hourly_rate_chf,
       website_url, instagram_url, verification_status)
    values ('00000000-0000-0000-0000-0000000000b3', '{}', '{photo}', '{}', null, null, null, 'verified')$$,
  '42501',
  null,
  'a photographer cannot INSERT their own row including verification_status (legacy hole closed)'
);
reset role;

-- ── 10-11: F1 regression — the exact 7-col onboarding upsert works twice ─
-- Mirrors the PostgREST upsert (`onConflict: profile_id`) which the
-- onboarding action sends, including the on-conflict SET clause covering
-- every inserted column (PostgREST includes the conflict target itself).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select lives_ok(
  $$insert into public.photographer_details
      (profile_id, specialties, disciplines, coverage_cantons, hourly_rate_chf,
       website_url, instagram_url)
    values ('00000000-0000-0000-0000-0000000000b3', '{wedding}', '{photo}', '{ZH}', 150,
            'https://example.ch', 'insta')
    on conflict (profile_id) do update set
      profile_id = excluded.profile_id,
      specialties = excluded.specialties,
      disciplines = excluded.disciplines,
      coverage_cantons = excluded.coverage_cantons,
      hourly_rate_chf = excluded.hourly_rate_chf,
      website_url = excluded.website_url,
      instagram_url = excluded.instagram_url$$,
  'the onboarding upsert''s fresh-insert path succeeds as authenticated'
);
select lives_ok(
  $$insert into public.photographer_details
      (profile_id, specialties, disciplines, coverage_cantons, hourly_rate_chf,
       website_url, instagram_url)
    values ('00000000-0000-0000-0000-0000000000b3', '{portrait}', '{photo,video}', '{BE}', 200,
            'https://example2.ch', 'insta2')
    on conflict (profile_id) do update set
      profile_id = excluded.profile_id,
      specialties = excluded.specialties,
      disciplines = excluded.disciplines,
      coverage_cantons = excluded.coverage_cantons,
      hourly_rate_chf = excluded.hourly_rate_chf,
      website_url = excluded.website_url,
      instagram_url = excluded.instagram_url$$,
  'the onboarding upsert''s conflict-update path also succeeds as authenticated'
);
reset role;

-- ── 12: F2 — photographer cannot backdate a bid's created_at ───────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
select throws_ok(
  $$update public.bids set created_at = now() - interval '90 days'
      where id = '20000000-0000-0000-0000-0000000000b1'$$,
  '42501',
  null,
  'a photographer cannot backdate their own bid''s created_at'
);
reset role;

-- ── 13-14: subscriptions_source_shape CHECK constraint ──────────────────
select throws_ok(
  $$insert into public.subscriptions (user_id, plan, status, source, comp_until)
      values ('00000000-0000-0000-0000-0000000000b2', 'basic', 'comp', 'admin_comp', null)$$,
  '23514',
  null,
  'comp source without comp_until violates subscriptions_source_shape'
);
select throws_ok(
  $$insert into public.subscriptions (user_id, plan, status, source, current_period_end)
      values ('00000000-0000-0000-0000-0000000000b2', 'basic', 'comp', 'stripe', now() + interval '1 day')$$,
  '23514',
  null,
  'stripe source with status=comp violates subscriptions_source_shape'
);

-- ── 15: sanity — service_role (the app's server-only writer) can write
--       plan_tier directly, since its table-wide grant is unaffected by the
--       authenticated column-scoping above. ───────────────────────────────
set local role service_role;
select lives_ok(
  $$update public.photographer_details set plan_tier = 'basic'
      where profile_id = '00000000-0000-0000-0000-0000000000b5'$$,
  'service_role can write plan_tier directly'
);
reset role;

-- ── 16: seed trigger — a comp subscription seeds plan_tier on first insert ─
insert into public.subscriptions (user_id, plan, status, source, comp_until)
values ('00000000-0000-0000-0000-0000000000b6', 'premium', 'comp', 'admin_comp', now() + interval '60 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b6","role":"authenticated"}';
insert into public.photographer_details (profile_id, specialties, disciplines, coverage_cantons)
values ('00000000-0000-0000-0000-0000000000b6', '{}', '{photo}', '{}');
reset role;

select is(
  (select plan_tier from public.photographer_details
     where profile_id = '00000000-0000-0000-0000-0000000000b6'),
  'premium',
  'the seed trigger fills plan_tier from an active comp subscription on first insert'
);

-- ── 17-18: photographer_effective_tier view ──────────────────────────────
set local role service_role;
update public.photographer_details set plan_tier = 'standard', plan_expires_at = now() - interval '1 day'
  where profile_id = '00000000-0000-0000-0000-0000000000b3';
reset role;
select is(
  (select effective_tier from public.photographer_effective_tier
     where profile_id = '00000000-0000-0000-0000-0000000000b3'),
  'free',
  'an expired plan_expires_at reads back as the free effective tier'
);

select is(
  (select effective_tier from public.photographer_effective_tier
     where profile_id = '00000000-0000-0000-0000-0000000000b6'),
  'premium',
  'a future plan_expires_at reads back as the granted effective tier'
);

select * from finish();
rollback;
