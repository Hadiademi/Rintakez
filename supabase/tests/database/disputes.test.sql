-- Dispute RLS from 20260622100000_disputes.sql: a participant of a booked shoot
-- can open a dispute; outsiders cannot; not allowed on an open (unbooked) shoot.
begin;
create extension if not exists pgtap;

select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dspc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Dispute Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dspf@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Dispute Photographer"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dspg@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Outsider Photographer"}', now(), now());

-- Assigned shoot S (client D1, accepted photographer D2) + an open shoot O.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000d1',
   'Assigned shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000d1',
   'Open shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE',
   '2027-12-02', 2, 500, 900);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000d6', '10000000-0000-0000-0000-0000000000d4',
   '00000000-0000-0000-0000-0000000000d2', 700, 'Accepted bid.');

update public.shoots
  set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000d6'
  where id = '10000000-0000-0000-0000-0000000000d4';

-- 1: the accepted photographer can open a dispute on the assigned shoot.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select lives_ok(
  $$insert into public.disputes (shoot_id, opened_by, reason)
    values ('10000000-0000-0000-0000-0000000000d4',
            '00000000-0000-0000-0000-0000000000d2', 'Photographer did not deliver.')$$,
  'the accepted photographer can open a dispute on the assigned shoot'
);
reset role;

-- 2: an uninvolved photographer cannot open a dispute on that shoot.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select throws_ok(
  $$insert into public.disputes (shoot_id, opened_by, reason)
    values ('10000000-0000-0000-0000-0000000000d4',
            '00000000-0000-0000-0000-0000000000d3', 'I am not involved here.')$$,
  '42501',
  null,
  'an outsider cannot open a dispute on a shoot they do not belong to'
);
reset role;

-- 3: the client cannot open a dispute on an OPEN (unbooked) shoot.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select throws_ok(
  $$insert into public.disputes (shoot_id, opened_by, reason)
    values ('10000000-0000-0000-0000-0000000000d5',
            '00000000-0000-0000-0000-0000000000d1', 'Too early to dispute.')$$,
  '42501',
  null,
  'a dispute cannot be opened on an open (unbooked) shoot'
);
reset role;

select * from finish();
rollback;
