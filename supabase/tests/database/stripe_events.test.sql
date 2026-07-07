-- stripe_events posture from 20260707100000_stripe_events.sql (spec:
-- subs-P3-brief). Webhook dedupe table: written only by the service-role
-- admin client from the /api/stripe/webhook route. No anon/authenticated
-- grants at all, mirroring the subscriptions table's write posture.
begin;
create extension if not exists pgtap;

select plan(5);

-- ── 1-3: authenticated has no select/insert/update on stripe_events ─────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000009e01","role":"authenticated"}';
select throws_ok(
  $$select count(*)::int from public.stripe_events$$,
  '42501',
  null,
  'authenticated cannot SELECT from stripe_events'
);
select throws_ok(
  $$insert into public.stripe_events (id, type) values ('evt_test_1', 'customer.subscription.updated')$$,
  '42501',
  null,
  'authenticated cannot INSERT into stripe_events'
);
select throws_ok(
  $$update public.stripe_events set type = 'x' where id = 'evt_test_1'$$,
  '42501',
  null,
  'authenticated cannot UPDATE stripe_events'
);
reset role;

-- ── 4: anon has no grant at all ──────────────────────────────────────────
set local role anon;
select throws_ok(
  $$select count(*)::int from public.stripe_events$$,
  '42501',
  null,
  'anon has no SELECT grant on stripe_events at all'
);
reset role;

-- ── 5: sanity — service_role (the webhook route's writer) can insert ────
set local role service_role;
select lives_ok(
  $$insert into public.stripe_events (id, type) values ('evt_test_1', 'customer.subscription.updated')$$,
  'service_role can insert into stripe_events'
);
reset role;

select * from finish();
rollback;
