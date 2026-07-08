-- Tier A (A4 + A5) — durable email outbox + stale-shoot handling.

-- ── email outbox ────────────────────────────────────────────────────
-- Notification emails were sent inline in the request path, best-effort, with no
-- retry — a Resend blip silently dropped them and a slow call blocked the action.
-- Now actions enqueue a row here (fast insert) and a scheduled drainer sends with
-- retry. Service-role only; no anon/authenticated access.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  shoot_id uuid,
  shoot_title text,
  status text not null default 'pending', -- pending | sent | failed
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_pending_idx
  on public.email_outbox (created_at)
  where status = 'pending';

alter table public.email_outbox enable row level security;
grant all on public.email_outbox to service_role;

-- ── stale shoots ────────────────────────────────────────────────────
-- Open shoots whose date has passed must not keep accepting bids. Recreate the
-- bid insert policy (latest wins) adding a date guard alongside the existing
-- role/suspension/shoot-state checks. (Past-date shoots are also filtered from
-- the public browse query in the app.)
drop policy "bids_insert_photographer" on public.bids;
create policy "bids_insert_photographer" on public.bids
  for insert with check (
    photographer_id = auth.uid()
    and public.has_role('photographer')
    and not public.is_suspended()
    and exists (
      select 1 from public.shoots s
      where s.id = shoot_id
        and s.status = 'open'
        and s.client_id <> auth.uid()
        and not s.is_suspended
        and s.shoot_date >= current_date
    )
  );
