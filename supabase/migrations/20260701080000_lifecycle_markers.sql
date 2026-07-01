-- Idempotency marker for cron-driven lifecycle emails (Task C2). The welcome
-- email is idempotent by construction (one profile insert -> one trigger fire),
-- but the other three lifecycle emails (onboarding_reminder, zero_bid_rescue,
-- review_request) are found by a periodic cron SCAN re-evaluating the same
-- predicate on every run — without a marker, a photographer who is still
-- missing photographer_details on day 4 would get re-enqueued on day 5, 6, ...
-- This table records "kind X has already been sent about subject Y" so each
-- scan can exclude already-notified subjects. Service-role only, same posture
-- as email_outbox (20260622040000_reliability.sql): RLS enabled, no grants to
-- anon/authenticated — only the cron's admin/service-role client touches it.

create table public.lifecycle_email_log (
  kind text not null,
  subject_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (kind, subject_id)
);

alter table public.lifecycle_email_log enable row level security;
grant all on public.lifecycle_email_log to service_role;
