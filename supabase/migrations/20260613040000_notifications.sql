-- In-app notifications. Rows are created only by SECURITY DEFINER triggers
-- (never directly by users), so the client cannot forge notifications. Users
-- may read and mark-as-read only their own. The table is added to the realtime
-- publication so the bell can update live.

create type public.notification_type as enum (
  'bid_received',  -- → shoot client, when a photographer bids
  'bid_accepted',  -- → photographer, when their bid is accepted
  'bid_declined'   -- → photographer, when their bid is declined
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  shoot_id uuid references public.shoots (id) on delete cascade,
  bid_id uuid references public.bids (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;

-- No INSERT grant: only the definer triggers below create rows.
grant select, update on public.notifications to authenticated;

create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

-- Users may only mark their own notifications read (cannot reassign ownership).
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── triggers ─────────────────────────────────────────────────────────
-- New bid → notify the shoot's client.
create or replace function public.notify_bid_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
begin
  select client_id into v_client from shoots where id = new.shoot_id;
  if v_client is not null and v_client <> new.photographer_id then
    insert into notifications (user_id, type, shoot_id, bid_id)
    values (v_client, 'bid_received', new.shoot_id, new.id);
  end if;
  return new;
end;
$$;

create trigger on_bid_insert
  after insert on public.bids
  for each row execute function public.notify_bid_received();

-- Bid accepted/declined → notify the bidding photographer. Covers accept_bid,
-- decline_bid and the sibling auto-decline (all of which UPDATE bids.status).
create or replace function public.notify_bid_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('accepted', 'declined') then
    insert into notifications (user_id, type, shoot_id, bid_id)
    values (
      new.photographer_id,
      case when new.status = 'accepted' then 'bid_accepted'::notification_type
           else 'bid_declined'::notification_type end,
      new.shoot_id,
      new.id
    );
  end if;
  return new;
end;
$$;

create trigger on_bid_status_change
  after update on public.bids
  for each row execute function public.notify_bid_status();

-- ── realtime ─────────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL so Realtime can evaluate the RLS policy (which
-- references user_id) against the row image and deliver the full payload.
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.notifications;
