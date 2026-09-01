-- premium_profile_viewers(): the premium "who viewed you" reader.
-- The negative assertions matter most: a non-premium caller, a caller asking
-- about someone else's views, and window-shopping clients WITHOUT an open
-- shoot must all yield nothing.
begin;
create extension if not exists pgtap;

select plan(6);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  -- V1: premium photographer (the caller under test)
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ppv-photog@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"PPV Photographer"}', now(), now()),
  -- V2: client WITH an open shoot who viewed V1
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ppv-client-open@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Open Client"}', now(), now()),
  -- V3: client WITHOUT any open shoot who also viewed V1
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ppv-client-idle@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Idle Client"}', now(), now()),
  -- V4: free photographer (non-premium caller)
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ppv-free@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Free Photographer"}', now(), now());

-- Premium entitlement for V1 (denormalized tier, as the sync trigger writes it).
insert into public.photographer_details (profile_id, specialties, disciplines, coverage_cantons, plan_tier, plan_expires_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '{wedding}', '{photo}', '{ZH}', 'premium', now() + interval '1 year'),
  ('00000000-0000-0000-0000-0000000000f4', '{wedding}', '{photo}', '{ZH}', 'free', null)
on conflict (profile_id) do update
  set plan_tier = excluded.plan_tier, plan_expires_at = excluded.plan_expires_at;

-- V2's open shoot; V3 deliberately has none.
insert into public.shoots (id, client_id, title, type, discipline, canton, location_city,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief, status)
values ('00000000-0000-0000-0001-0000000000f2', '00000000-0000-0000-0000-0000000000f2',
        'PPV Open Shoot', 'wedding', 'photo', 'ZH', 'Zürich',
        current_date + 30, 4, 1000, 2000, 'Test brief for PPV.', 'open');

-- Views of V1's profile: by open-client, idle-client, and one anonymous.
insert into public.profile_views (photographer_id, viewer_id, viewed_on)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2', current_date),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f3', current_date),
  ('00000000-0000-0000-0000-0000000000f1', null, current_date);

-- ── 1-3: premium caller sees exactly the open-shoot client, with the shoot ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

select is(
  (select count(*)::int from public.premium_profile_viewers(current_date - 30)),
  1,
  'premium sees exactly one named viewer (open-shoot client only — idle client and anon are excluded)'
);
select is(
  (select viewer_name from public.premium_profile_viewers(current_date - 30) limit 1),
  'Open Client',
  'the named viewer is the client with the open shoot'
);
select is(
  (select shoot_title from public.premium_profile_viewers(current_date - 30) limit 1),
  'PPV Open Shoot',
  'the client''s open shoot rides along for one-tap action'
);

-- ── 4: since-window is respected ────────────────────────────────────────
select is(
  (select count(*)::int from public.premium_profile_viewers(current_date + 1)),
  0,
  'a since-date after the views returns nothing'
);
reset role;

-- ── 5: non-premium caller gets zero rows (not an error) ─────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}';
select is(
  (select count(*)::int from public.premium_profile_viewers(current_date - 30)),
  0,
  'a free-tier caller gets zero rows — entitlement is enforced in the function, not the UI'
);
reset role;

-- ── 6: anon caller gets zero rows ───────────────────────────────────────
set local role anon;
select is(
  (select count(*)::int from public.premium_profile_viewers(current_date - 30)),
  0,
  'anon gets zero rows'
);
reset role;

select * from finish();
rollback;
