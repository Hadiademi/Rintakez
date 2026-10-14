-- 20261014120000_counterparty_notifications.sql: the other side hears about
-- withdrawn / changed / re-sent offers, edited / cancelled / completed shoots,
-- opened / closed disputes and shoots that lapsed without a booking. App
-- actions run as the signed-in user (RLS + column grants as in production);
-- admin-only steps run as the owner, like the service role does.
begin;
create extension if not exists pgtap;

select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-0000-0000-0000000001' || k)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'cpn-' || k || '@test.ch',
       extensions.crypt('pw', extensions.gen_salt('bf')), now(),
       json_build_object('role', r, 'display_name', 'CPN ' || k)::jsonb, now(), now()
from (values ('c1', 'client'), ('f1', 'photographer'), ('f2', 'photographer'),
             ('f3', 'photographer')) as v(k, r);

create function pg_temp.uid(k text) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-0000000001' || k)::uuid
$$;
create function pg_temp.sid(k text) returns uuid language sql as $$
  select ('10000000-0000-0000-0000-0000000001' || k)::uuid
$$;
create function pg_temp.bid(k text) returns uuid language sql as $$
  select ('20000000-0000-0000-0000-0000000001' || k)::uuid
$$;
create function pg_temp.today() returns date language sql as $$
  select (now() at time zone 'Europe/Zurich')::date
$$;
create function pg_temp.count(k text, t text, s text) returns bigint language sql as $$
  select count(*) from public.notifications
  where user_id = pg_temp.uid(k) and type::text = t and shoot_id = pg_temp.sid(s)
$$;
create function pg_temp.as_user(k text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.uid(k), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- d1: open shoot with offers from f1, f2 (pending) and f3 (withdrawn).
-- a1: f1's booking. c2: open, f1 pending (suspension check).
-- e1 / f1: open shoots far in the future (the expiry scan is called with a
-- made-up "today" in 2099, so real seed / e2e data can never interfere).
insert into public.shoots (id, client_id, title, type, discipline, brief, location_city, canton,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf)
select pg_temp.sid(k), pg_temp.uid('c1'), 'CPN ' || k, 'portrait', 'photo',
       'Brief long enough for the checks.', 'Bern', 'BE', d, 2, 300, 600
from (values ('d1', pg_temp.today() + 20), ('a1', pg_temp.today() + 10),
             ('c2', pg_temp.today() + 15),
             ('e1', date '2099-06-08'), ('f1', date '2099-05-01')) as v(k, d);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message, status)
values (pg_temp.bid('b1'), pg_temp.sid('d1'), pg_temp.uid('f1'), 400, 'First offer from p1.', 'pending'),
       (pg_temp.bid('b2'), pg_temp.sid('d1'), pg_temp.uid('f2'), 450, 'First offer from p2.', 'pending'),
       (pg_temp.bid('b3'), pg_temp.sid('d1'), pg_temp.uid('f3'), 500, 'Offer p3 withdrew.', 'withdrawn'),
       (pg_temp.bid('a1'), pg_temp.sid('a1'), pg_temp.uid('f1'), 480, 'Booked offer.', 'pending'),
       (pg_temp.bid('c2'), pg_temp.sid('c2'), pg_temp.uid('f1'), 350, 'Offer on c2.', 'pending');
update public.bids set status = 'accepted' where id = pg_temp.bid('a1');
update public.shoots set status = 'assigned', accepted_bid_id = pg_temp.bid('a1')
 where id = pg_temp.sid('a1');

-- ── Offers → client ──────────────────────────────────────────────────
select pg_temp.as_user('f1');
update public.bids set amount_chf = 420 where id = pg_temp.bid('b1');
update public.bids set message = 'Changed my mind again.' where id = pg_temp.bid('b1');
select pg_temp.as_user('f2');
update public.bids set status = 'withdrawn' where id = pg_temp.bid('b2');
reset role;

select is(pg_temp.count('c1', 'bid_updated', 'd1'), 1::bigint,
  'a changed offer tells the client, once while unread');
select is(pg_temp.count('c1', 'bid_withdrawn', 'd1'), 1::bigint,
  'a withdrawn offer tells the client');

-- As the owner: the monthly quota (Free = 1, withdrawn included) would
-- refuse this revival for a signed-in Free photographer, which is right but
-- not what this checks.
update public.bids set status = 'pending', amount_chf = 440 where id = pg_temp.bid('b2');
select is(
  (select count(*) from public.notifications
   where user_id = pg_temp.uid('c1') and type = 'bid_received' and bid_id = pg_temp.bid('b2')
     and created_at > (select min(created_at) from public.notifications
                       where type = 'bid_withdrawn' and bid_id = pg_temp.bid('b2'))),
  0::bigint, 'a re-sent offer is not announced again while the first one is still unread');

update public.notifications set read_at = now()
 where user_id = pg_temp.uid('c1') and bid_id = pg_temp.bid('b2');
update public.bids set status = 'withdrawn' where id = pg_temp.bid('b2');
update public.bids set status = 'pending' where id = pg_temp.bid('b2');
update public.bids set status = 'withdrawn' where id = pg_temp.bid('b2');
update public.bids set status = 'pending' where id = pg_temp.bid('b2');
select is(
  (select count(*) from public.notifications
   where user_id = pg_temp.uid('c1') and bid_id = pg_temp.bid('b2') and read_at is null),
  2::bigint, 'toggling an offer back and forth yields one withdrawn + one re-sent, not a flood');

update public.notifications set read_at = now()
 where user_id = pg_temp.uid('c1') and type = 'bid_updated';
select pg_temp.as_user('f1');
update public.bids set amount_chf = 410 where id = pg_temp.bid('b1');
reset role;
select is(pg_temp.count('c1', 'bid_updated', 'd1'), 2::bigint,
  'once the client has read it, the next change tells them again');

-- ── Not every update is an edit ──────────────────────────────────────
update public.shoots set is_suspended = true where id = pg_temp.sid('c2');
select is(pg_temp.count('f1', 'shoot_updated', 'c2'), 0::bigint,
  'an admin suspension is not reported to bidders as an edit');
select is(
  (select count(*) from public.notifications
   where shoot_id = pg_temp.sid('a1')
     and type::text in ('bid_withdrawn', 'bid_updated', 'shoot_updated', 'shoot_cancelled')),
  0::bigint, 'accepting an offer (assign) sends none of the new kinds');

-- ── Shoot edited → pending bidders ───────────────────────────────────
select pg_temp.as_user('c1');
update public.shoots set budget_max_chf = 700 where id = pg_temp.sid('d1');
update public.shoots set shoot_date = shoot_date + 1 where id = pg_temp.sid('d1');
reset role;

select is(pg_temp.count('f1', 'shoot_updated', 'd1'), 1::bigint,
  'an edit tells a photographer with a pending offer, once while unread');
select is(pg_temp.count('f2', 'shoot_updated', 'd1'), 1::bigint,
  'every pending bidder hears it');
select is(pg_temp.count('f3', 'shoot_updated', 'd1'), 0::bigint,
  'a withdrawn bidder does not');

-- ── Open shoot cancelled → pending bidders ───────────────────────────
select pg_temp.as_user('c1');
update public.shoots set status = 'cancelled' where id = pg_temp.sid('d1');
reset role;

select is(
  (select string_agg(right(user_id::text, 2), ',' order by user_id) from public.notifications
   where type = 'shoot_cancelled' and shoot_id = pg_temp.sid('d1')),
  'f1,f2', 'cancelling an open shoot tells exactly the photographers still waiting');

-- …and they can open it (the notification links there), others can't.
select pg_temp.as_user('f1');
select is((select count(*) from public.shoots where id = pg_temp.sid('d1')), 1::bigint,
  'a photographer still waiting can read the cancelled shoot');
select pg_temp.as_user('f3');
select is((select count(*) from public.shoots where id = pg_temp.sid('d1')), 0::bigint,
  'a photographer who withdrew cannot');
reset role;

select pg_temp.as_user('f1');
update public.bids set status = 'withdrawn' where id = pg_temp.bid('b1');
reset role;
select is(
  (select count(*) from public.notifications
   where type = 'bid_withdrawn' and bid_id = pg_temp.bid('b1')),
  0::bigint, 'withdrawing from an already cancelled shoot tells the client nothing');

-- ── Booking completed → its photographer ─────────────────────────────
update public.shoots set status = 'completed' where id = pg_temp.sid('a1');
select is(pg_temp.count('f1', 'shoot_completed', 'a1'), 1::bigint,
  'completing a booking tells the booked photographer');

-- ── Disputes → counterparty, then both ───────────────────────────────
select pg_temp.as_user('c1');
insert into public.disputes (shoot_id, opened_by, reason)
values (pg_temp.sid('a1'), pg_temp.uid('c1'), 'The photos never arrived as agreed.');
reset role;

select is(pg_temp.count('f1', 'dispute_opened', 'a1'), 1::bigint,
  'a dispute tells the other party');
select is(pg_temp.count('c1', 'dispute_opened', 'a1'), 0::bigint,
  'not the one who opened it');

update public.disputes set status = 'resolved', resolved_at = now()
 where shoot_id = pg_temp.sid('a1');
select is(
  pg_temp.count('f1', 'dispute_resolved', 'a1') + pg_temp.count('c1', 'dispute_resolved', 'a1'),
  2::bigint, 'closing a dispute tells both parties');

insert into public.disputes (shoot_id, opened_by, reason)
values (pg_temp.sid('a1'), pg_temp.uid('c1'), 'Opened again through the API.');
select is(pg_temp.count('f1', 'dispute_opened', 'a1'), 1::bigint,
  'repeated disputes do not flood the other party while the first notice is unread');
update public.disputes set status = 'dismissed', resolved_at = now()
 where shoot_id = pg_temp.sid('a1') and status = 'open';
select is(
  pg_temp.count('f1', 'dispute_resolved', 'a1') + pg_temp.count('c1', 'dispute_resolved', 'a1'),
  4::bigint, 'a dismissed dispute is reported to both parties too');

-- ── Expired open shoots (cron) ───────────────────────────────────────
select is(public.lifecycle_notify_expired_shoots(date '2099-06-10'), 1,
  'a shoot whose date passed in the last week is reported');
select is(public.lifecycle_notify_expired_shoots(date '2099-06-10'), 0,
  'each expired shoot is reported once');
select is(pg_temp.count('c1', 'shoot_expired', 'e1') + pg_temp.count('c1', 'shoot_expired', 'f1'),
  1::bigint, 'only the recent one: a shoot that lapsed a month ago stays quiet');

select ok(
  not has_function_privilege('anon', 'public.lifecycle_notify_expired_shoots(date, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.lifecycle_notify_expired_shoots(date, integer)', 'execute')
  and has_function_privilege('service_role', 'public.lifecycle_notify_expired_shoots(date, integer)', 'execute'),
  'only the service role (cron) can run the expiry scan');

select * from finish();
rollback;
