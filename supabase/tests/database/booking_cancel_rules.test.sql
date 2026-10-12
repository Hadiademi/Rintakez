-- 20261013130000_booking_cancel_rules.sql: a client may call off a booking
-- (assigned -> cancelled) only before the shoot day and never while a
-- dispute is open. Without this, a client could turn a delivered job into
-- "cancelled" after the fact, which hid the photographer's open dispute,
-- blocked a new one and removed the job from their completed count (review
-- of PR C, 2026-10-12). Admin tooling (service role) is not limited.
begin;
create extension if not exists pgtap;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bcr-client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"BCR Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bcr-photog@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"BCR Photographer"}', now(), now());

-- Zurich's calendar date, the same "today" the rule uses.
create function pg_temp.today() returns date language sql as $$
  select (now() at time zone 'Europe/Zurich')::date
$$;

-- Five bookings: a = in 10 days, b = today, c = 3 days ago, d = in 10 days
-- with an open dispute, e = 3 days ago (for the admin path). Plus f, an open
-- (never booked) shoot whose date has passed.
insert into public.shoots (id, client_id, title, type, discipline, brief, location_city, canton,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf)
select ('10000000-0000-0000-0000-0000000000' || k)::uuid, '00000000-0000-0000-0000-0000000000c1',
       'BCR ' || k, 'portrait', 'photo', 'Brief long enough for the checks.', 'Bern', 'BE',
       pg_temp.today() + d, 2, 300, 600
from (values ('a1', 10), ('b1', 0), ('c1', -3), ('d1', 10), ('e1', -3), ('f1', -3)) as v(k, d);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
select ('20000000-0000-0000-0000-0000000000' || k)::uuid, ('10000000-0000-0000-0000-0000000000' || k)::uuid,
       '00000000-0000-0000-0000-0000000000f1', 450, 'Booked through the platform.'
from unnest(array['a1', 'b1', 'c1', 'd1', 'e1']) as k;

update public.shoots s
   set status = 'assigned', accepted_bid_id = ('20000000-0000-0000-0000-0000000000' || right(s.id::text, 2))::uuid
 where s.id in ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000b1',
                '10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000d1',
                '10000000-0000-0000-0000-0000000000e1');

insert into public.disputes (shoot_id, opened_by, reason)
values ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
        'The client changed the brief completely.');

create function pg_temp.cancel(k text) returns text language sql as $$
  select format('update public.shoots set status = %L where id = %L', 'cancelled',
                '10000000-0000-0000-0000-0000000000' || k)
$$;

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select lives_ok(pg_temp.cancel('a1'), 'a booking can be cancelled before the shoot day');
select throws_ok(pg_temp.cancel('b1'), 'P0001', 'booking_past', 'not on the shoot day itself');
select throws_ok(pg_temp.cancel('c1'), 'P0001', 'booking_past', 'not after the shoot day');
select throws_ok(pg_temp.cancel('d1'), 'P0001', 'dispute_open', 'not while a dispute is open');
select lives_ok(pg_temp.cancel('f1'), 'an open (never booked) shoot can still be cancelled after its date');
reset role;

select is(
  (select string_agg(right(id::text, 2) || '=' || status, ',' order by id) from public.shoots
   where id::text like '10000000-0000-0000-0000-0000000000%' and title like 'BCR %'),
  'a1=cancelled,b1=assigned,c1=assigned,d1=assigned,e1=assigned,f1=cancelled',
  'only the allowed cancellations happened'
);

select lives_ok(pg_temp.cancel('e1'), 'admin tooling (not the authenticated role) can still cancel a past booking');

select * from finish();
rollback;
