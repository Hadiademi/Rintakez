-- P3 — Stripe webhook event dedupe table (spec: subs-P3-brief).
-- Stripe retries webhook deliveries (network errors, slow responses,
-- multiple event types racing) so the same event id can arrive more than
-- once. The webhook route inserts the event id here BEFORE processing; a
-- unique-violation on retry means "already processed" and the handler noops
-- with 200 instead of double-applying a subscription change.
create table public.stripe_events (
  id text primary key,               -- Stripe event id (evt_...)
  type text not null,
  created_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- Service-role only: NO grants to anon/authenticated (mirrors the
-- subscriptions posture in 20260707000000_subscriptions.sql). The webhook
-- route always writes via the service-role admin client. service_role
-- already has table-wide access via the default-privileges migration
-- (20260613110000_service_role_grants.sql: `grant all on all tables in
-- schema public to service_role` + `alter default privileges ... grant all
-- on tables to service_role`), so this new table is automatically covered —
-- no explicit service_role grant needed here.
