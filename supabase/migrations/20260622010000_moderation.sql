-- Tier A (A1 + A6a) — moderation enforcement + audit log.
-- Before this, admins could only mark a report reviewed/dismissed; there was no
-- way to ACT on abuse. This adds account/shoot suspension, enforces it at the
-- RLS boundary, and records sensitive admin actions in an immutable audit log.

-- ── suspension state ────────────────────────────────────────────────
-- Set only by trusted server code (service role); the column-scoped UPDATE
-- grant on profiles (20260613100000_admin) already excludes these, so a user
-- cannot self-modify them.
alter table public.profiles
  add column is_suspended boolean not null default false,
  add column suspension_reason text,
  add column suspended_at timestamptz;

alter table public.shoots
  add column is_suspended boolean not null default false,
  add column suspended_reason text;

-- Lock down the shoots UPDATE grant to the only columns a client legitimately
-- changes (cancellation via cancelShootAction). This stops a user from clearing
-- is_suspended on their own shoot — and is defense-in-depth around accepted_bid_id.
revoke update on public.shoots from authenticated;
grant update (status, cancellation_reason) on public.shoots to authenticated;

-- True when the CURRENT user is suspended. SECURITY DEFINER to avoid RLS
-- recursion when referenced inside other tables' policies.
create or replace function public.is_suspended()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_suspended from public.profiles where id = auth.uid()), false);
$$;

-- ── audit log ───────────────────────────────────────────────────────
-- Append-only record of sensitive/admin actions (who did what, when). Written
-- by trusted server code via the service role; not readable by anon/authenticated.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_target_idx
  on public.audit_log (target_type, target_id, created_at desc);

alter table public.audit_log enable row level security;
-- No anon/authenticated grants and no policies: only the service role (which
-- bypasses RLS) can read or write it.
grant all on public.audit_log to service_role;

-- ── enforce suspension at the RLS boundary ──────────────────────────
-- A suspended user cannot create new content. Recreate each insert policy with
-- an added `not public.is_suspended()` guard (no behaviour change for normal
-- users, who are not suspended).

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
    )
  );

drop policy "shoots_insert_client" on public.shoots;
create policy "shoots_insert_client" on public.shoots
  for insert with check (
    client_id = auth.uid()
    and public.has_role('client')
    and not public.is_suspended()
  );

drop policy "messages_insert_participant" on public.messages;
create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not public.is_suspended()
  );

drop policy "reviews_insert_client" on public.reviews;
create policy "reviews_insert_client" on public.reviews
  for insert with check (
    client_id = auth.uid()
    and not public.is_suspended()
    and exists (
      select 1
      from shoots s
      join bids b on b.id = s.accepted_bid_id
      where s.id = reviews.shoot_id
        and s.client_id = auth.uid()
        and s.status = 'completed'
        and b.photographer_id = reviews.photographer_id
    )
  );

drop policy "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (
    reporter_id = auth.uid()
    and not public.is_suspended()
  );

-- Hide suspended shoots from the public/open browse (owner + assigned
-- photographer still see them so they understand the state).
drop policy "shoots_select" on public.shoots;
create policy "shoots_select" on public.shoots
  for select using (
    (status = 'open' and not is_suspended)
    or client_id = auth.uid()
    or public.is_accepted_photographer(id)
  );

-- accept_bid must also refuse a suspended client. Recreate the hardened
-- function (20260613010720) with the added guard.
create or replace function public.accept_bid(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shoot_id uuid;
  v_client_id uuid;
begin
  if public.is_suspended() then
    raise exception 'account suspended' using errcode = 'P0001';
  end if;

  select b.shoot_id, s.client_id
    into v_shoot_id, v_client_id
  from bids b
  join shoots s on s.id = b.shoot_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and s.status = 'open'
    and s.accepted_bid_id is null
  for update of b, s;

  if v_shoot_id is null then
    raise exception 'bid not acceptable';
  end if;

  if v_client_id is distinct from auth.uid() then
    raise exception 'not your shoot';
  end if;

  update bids set status = 'accepted' where id = p_bid_id;

  update bids set status = 'declined'
  where shoot_id = v_shoot_id and id <> p_bid_id and status = 'pending';

  update shoots set status = 'assigned', accepted_bid_id = p_bid_id
  where id = v_shoot_id;
end;
$$;

-- ── report resolution metadata ──────────────────────────────────────
-- Record who resolved a report, when, and why (feeds the audit trail + appeals).
alter table public.reports
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column admin_note text;
