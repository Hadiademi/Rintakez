-- Reliability/stale-shoot guards from 20260622040000_reliability.sql (A4/A5).
-- Bids are refused on past-date shoots; the email_outbox is service-role only.
begin;
create extension if not exists pgtap;

select plan(2);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'relc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Rel Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'relf@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Rel Photographer"}', now(), now());

-- A shoot whose date is in the past (open).
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000cd', '00000000-0000-0000-0000-0000000000ca',
   'Past shoot', 'portrait', 'This shoot date has already passed.', 'Bern', 'BE',
   '2020-01-01', 2, 500, 900);

-- ── 1: a photographer cannot bid on a past-date shoot ────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000cb","role":"authenticated"}';
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-0000000000cd',
            '00000000-0000-0000-0000-0000000000cb', 700, 'Bid on a past shoot.')$$,
  '42501',
  null,
  'a photographer cannot bid on a past-date shoot'
);

-- ── 2: the email_outbox is not readable by an authenticated user ─────
select throws_ok(
  $$select * from public.email_outbox$$,
  '42501',
  null,
  'authenticated users cannot read the email_outbox'
);
reset role;

select * from finish();
rollback;
