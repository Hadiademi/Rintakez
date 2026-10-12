-- 20261013120000_db_hardening.sql: limits the app enforced only in server
-- actions are now enforced by the database too, so a signed-in user calling
-- PostgREST directly gets the same answer as the app (2026-10-10 review):
--   * SEC-04  monthly bid quota (Free 1 / Basic 5 / Standard 32 / Premium ∞),
--             resolved from `subscriptions` exactly like effectivePlan()
--   * SEC-07  report throttle (10 per hour) and one pending admin alert per
--             admin instead of one email per report
--   * SEC-09  storage buckets: 5 MB, images only
--   * SEC-06  verification evidence is no longer world-readable
-- Writes as postgres/service role (fixtures, admin tooling) are not limited.
begin;
create extension if not exists pgtap;

select plan(31);

-- ── fixtures ────────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-0000-0000-0000000000' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'dbh-' || n || '@test.ch',
       extensions.crypt('pw', extensions.gen_salt('bf')), now(),
       json_build_object('role', case when n = 'c1' then 'client' else 'photographer' end,
                         'display_name', 'DBH ' || n)::jsonb, now(), now()
from unnest(array['c1', 'f1', 'f2', 'f3', 'b1', 'e1', 'a1', 'be', 'd1']) as n;
-- c1 client · f1 free (no row) · f2 free, bid last month · f3 free, withdrawn
-- b1 basic · e1 premium (stripe) · a1 premium (gift) · be basic, expired
-- d1 basic, past_due within the period

insert into public.photographer_details (profile_id, verification_note)
select ('00000000-0000-0000-0000-0000000000' || n)::uuid, 'ID: https://drive.example/' || n
from unnest(array['f1', 'f2', 'f3', 'b1', 'e1', 'a1', 'be', 'd1']) as n;

insert into public.subscriptions (user_id, plan, status, source, current_period_end, comp_until) values
  ('00000000-0000-0000-0000-0000000000b1', 'basic',   'active',   'stripe',     now() + interval '20 days', null),
  ('00000000-0000-0000-0000-0000000000e1', 'premium', 'active',   'stripe',     now() + interval '20 days', null),
  ('00000000-0000-0000-0000-0000000000a1', 'premium', 'comp',     'admin_comp', null, now() + interval '60 days'),
  ('00000000-0000-0000-0000-0000000000be', 'basic',   'active',   'stripe',     now() - interval '1 day', null),
  ('00000000-0000-0000-0000-0000000000d1', 'basic',   'past_due', 'stripe',     now() + interval '5 days', null);

-- 60 open future shoots to bid on.
insert into public.shoots (id, client_id, title, type, discipline, brief, location_city, canton,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000c1', 'DBH shoot ' || g, 'portrait', 'photo',
       'Brief long enough for the checks.', 'Bern', 'BE', current_date + 30, 2, 300, 600
from generate_series(1, 60) g;

-- Existing bids, written as the owner (not limited): b1 already used its 5,
-- p1 already has 40, f2's only bid is from last month, f3's was withdrawn.
insert into public.bids (shoot_id, photographer_id, amount_chf, message)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000b1', 400, 'Existing basic bid.'
from generate_series(1, 5) g;
insert into public.bids (shoot_id, photographer_id, amount_chf, message)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000e1', 400, 'Existing premium bid.'
from generate_series(1, 40) g;
insert into public.bids (shoot_id, photographer_id, amount_chf, message, created_at)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f2', 400,
        'Bid from last month.', (date_trunc('month', now() at time zone 'Europe/Zurich')
                                  at time zone 'Europe/Zurich') - interval '1 minute');
insert into public.bids (shoot_id, photographer_id, amount_chf, message, status)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f3', 400,
        'Withdrawn earlier this month.', 'withdrawn');
insert into public.bids (shoot_id, photographer_id, amount_chf, message)
select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '00000000-0000-0000-0000-0000000000be', 400, 'Bid while still basic.'
from generate_series(1, 1) g;

create function pg_temp.act_as(p text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000000000' || p, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.bid(p text, shoot int) returns text language sql as $$
  select format($f$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
                 values (%L, %L, 500, 'A bid placed through the API.')$f$,
                ('10000000-0000-0000-0000-' || lpad(shoot::text, 12, '0')),
                '00000000-0000-0000-0000-0000000000' || p);
$$;

-- ── 1-10: monthly bid quota ─────────────────────────────────────────────
set local role authenticated;

select pg_temp.act_as('f1');
select lives_ok(pg_temp.bid('f1', 50), 'free: the first bid of the month is accepted');
select throws_ok(pg_temp.bid('f1', 51), 'P0001', 'quota_reached', 'free: the second bid of the month is refused');

select pg_temp.act_as('f2');
select lives_ok(pg_temp.bid('f2', 50), 'a bid from last month does not count against this month');

select pg_temp.act_as('f3');
select throws_ok(
  $$update public.bids set status = 'pending'
    where photographer_id = '00000000-0000-0000-0000-0000000000f3'$$,
  'P0001', 'quota_reached',
  'reviving a withdrawn bid counts as a new offer (withdrawn bids still count)'
);

select pg_temp.act_as('b1');
select throws_ok(pg_temp.bid('b1', 50), 'P0001', 'quota_reached', 'basic: the 6th bid of the month is refused');

select pg_temp.act_as('d1');
select lives_ok(pg_temp.bid('d1', 50), 'past_due within the paid period keeps the plan, like effectivePlan');

select pg_temp.act_as('be');
select throws_ok(pg_temp.bid('be', 50), 'P0001', 'quota_reached', 'an expired subscription falls back to free');

select pg_temp.act_as('e1');
select lives_ok(pg_temp.bid('e1', 50), 'premium: no monthly cap (41st bid accepted)');

select pg_temp.act_as('a1');
select lives_ok(pg_temp.bid('a1', 50), 'a gifted premium plan has no cap either');

reset role;
select pg_temp.act_as('f1');
delete from public.bids where photographer_id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
select pg_temp.act_as('f1');
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    select ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
           '00000000-0000-0000-0000-0000000000f1', 500, 'Bulk bid through the API.'
    from generate_series(52, 55) g$$,
  'P0001', 'quota_reached',
  'free: a bulk insert of 4 bids is refused as a whole'
);
reset role;

-- ── the quota never blocks what the app allows ──────────────────────────
-- b1 is a Basic photographer at 5/5 this month.
set local role authenticated;
select pg_temp.act_as('b1');
select lives_ok(
  $$update public.bids set amount_chf = 450
    where photographer_id = '00000000-0000-0000-0000-0000000000b1'
      and shoot_id = '10000000-0000-0000-0000-000000000003'$$,
  'at quota: editing the amount of a pending bid still works'
);
select lives_ok(
  $$update public.bids set status = 'withdrawn'
    where photographer_id = '00000000-0000-0000-0000-0000000000b1'
      and shoot_id = '10000000-0000-0000-0000-000000000004'$$,
  'at quota: withdrawing a bid still works'
);
select pg_temp.act_as('c1');
select lives_ok(
  $$select public.accept_bid((select id from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000b1'
        and shoot_id = '10000000-0000-0000-0000-000000000001'))$$,
  'at quota: the client can still accept the photographer''s bid (siblings get declined)'
);
select lives_ok(
  $$select public.decline_bid((select id from public.bids
      where photographer_id = '00000000-0000-0000-0000-0000000000b1'
        and shoot_id = '10000000-0000-0000-0000-000000000002'))$$,
  'at quota: the client can still decline the photographer''s bid'
);
select pg_temp.act_as('d1');
select lives_ok(
  $$update public.bids set status = 'withdrawn'
    where photographer_id = '00000000-0000-0000-0000-0000000000d1'$$,
  'below quota: withdraw works'
);
select lives_ok(
  $$update public.bids set status = 'pending'
    where photographer_id = '00000000-0000-0000-0000-0000000000d1'$$,
  'below quota: reviving a withdrawn bid works'
);
reset role;
insert into public.subscriptions (user_id, plan, status, source, current_period_end) values
  ('00000000-0000-0000-0000-0000000000f2', 'basic', 'trialing', 'stripe', now() + interval '25 days');
select is(
  array[public.bid_quota_limit('00000000-0000-0000-0000-0000000000f2'),
        public.bid_quota_limit('00000000-0000-0000-0000-0000000000f1'),
        public.bid_quota_limit('00000000-0000-0000-0000-0000000000be'),
        public.bid_quota_limit('00000000-0000-0000-0000-0000000000a1')],
  array[5, 1, 1, null]::int[],
  'limits: trialing keeps the plan; no row and expired fall to free; gift premium is unlimited'
);

-- ── 11: the quota helpers are not callable by app roles ─────────────────
select ok(
  not has_function_privilege('anon', 'public.enforce_bid_quota()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.enforce_bid_quota()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.bid_quota_limit(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.bid_quota_limit(uuid)', 'EXECUTE'),
  'quota functions are internal (not executable by anon/authenticated)'
);

-- ── 12-15: reports ──────────────────────────────────────────────────────
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000c1';
create temp table admin_alerts_before as
  select count(*) as n from public.email_outbox
  where recipient_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'admin_alert' and status = 'pending';
grant select on admin_alerts_before to authenticated;

set local role authenticated;
select pg_temp.act_as('f1');
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    select '00000000-0000-0000-0000-0000000000f1', 'shoot',
           ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Looks like spam to me.'
    from generate_series(1, 10) g$$,
  'a reporter can file 10 reports in an hour'
);
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-0000000000f1', 'shoot',
            '10000000-0000-0000-0000-000000000011', 'One report too many.')$$,
  'P0001', 'limit_reached',
  'the 11th report within an hour is refused'
);
select pg_temp.act_as('f2');
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    select '00000000-0000-0000-0000-0000000000f2', 'shoot',
           ('10000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid, 'Flood attempt.'
    from generate_series(1, 500) g$$,
  'P0001', 'limit_reached',
  'a bulk insert of 500 reports is refused as a whole'
);
select pg_temp.act_as('f1');
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-0000000000f2', 'shoot',
            '10000000-0000-0000-0000-000000000012', 'Filed in someone else''s name.')$$,
  '42501', null,
  'a report in someone else''s name is refused by RLS, without revealing their report count'
);
reset role;
select is(
  (select count(*)::int from public.email_outbox
   where recipient_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'admin_alert' and status = 'pending')
  - (select n::int from admin_alerts_before),
  case when (select n from admin_alerts_before) > 0 then 0 else 1 end,
  'ten reports leave a single pending admin alert per admin, not ten'
);

-- ── 16-18: storage buckets ──────────────────────────────────────────────
select is(
  (select count(*)::int from storage.buckets
   where id in ('avatars', 'portfolio', 'shoot-refs', 'message-images')
     and file_size_limit = 5 * 1024 * 1024),
  4, 'every upload bucket caps files at 5 MB (the app''s own limit)'
);
select is(
  (select count(*)::int from storage.buckets
   where id in ('avatars', 'portfolio', 'shoot-refs', 'message-images')
     and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  4, 'every upload bucket accepts the image types phones produce'
);
select is(
  (select count(*)::int from storage.buckets
   where id in ('avatars', 'portfolio', 'shoot-refs', 'message-images')
     and (allowed_mime_types && array['text/html', 'image/svg+xml', 'application/octet-stream']
          or allowed_mime_types is null)),
  0, 'no upload bucket accepts HTML, SVG or arbitrary binaries'
);

-- ── 19-22: verification evidence ────────────────────────────────────────
select ok(
  not has_column_privilege('anon', 'public.photographer_details', 'verification_note', 'SELECT')
  and not has_column_privilege('authenticated', 'public.photographer_details', 'verification_note', 'SELECT'),
  'verification evidence is not readable through the API'
);
select ok(
  has_column_privilege('anon', 'public.photographer_details', 'specialties', 'SELECT')
  and has_column_privilege('anon', 'public.photographer_details', 'verification_status', 'SELECT')
  and has_column_privilege('authenticated', 'public.photographer_details', 'plan_expires_at', 'SELECT'),
  'the public profile columns stay readable'
);
select is(
  (select coalesce(string_agg(a.attname, ',' order by a.attname), '')
   from pg_attribute a
   where a.attrelid = 'public.photographer_details'::regclass and a.attnum > 0 and not a.attisdropped
     and not has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')),
  'verification_note',
  'every photographer_details column but the note stays readable (a new column must be granted)'
);
set local role authenticated;
select pg_temp.act_as('b1');
select is(
  public.my_verification_note(),
  'ID: https://drive.example/b1',
  'a photographer can still read their own note (data export)'
);
select pg_temp.act_as('c1');
select is(public.my_verification_note(), null, 'nobody else''s note leaks through the getter');
reset role;

select * from finish();
rollback;
