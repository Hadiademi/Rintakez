-- Shoot invitations: a client invites a specific photographer to one of their
-- OPEN shoots. Reuses the bid model (the photographer still bids via submit_bid
-- and is accepted via accept_bid) — this row is just a targeted pointer plus a
-- notification. Insert is RLS-gated; the notification is created by a
-- SECURITY DEFINER trigger, mirroring bids -> notify_bid_received.

alter type public.notification_type add value if not exists 'shoot_invitation';

create table public.shoot_invitations (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shoot_id, photographer_id)
);

create index shoot_invitations_photographer_idx
  on public.shoot_invitations (photographer_id, created_at desc);

-- SECURITY DEFINER helper: the caller owns the shoot and it is open. Mirrors the
-- can_view_shoot precedent so the insert policy's subquery does not re-enter
-- shoots RLS.
create or replace function public.can_invite_to_shoot(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shoots s
    where s.id = p_shoot_id
      and s.client_id = auth.uid()
      and s.status = 'open'
      and not s.is_suspended
  );
$$;

alter table public.shoot_invitations enable row level security;

grant select, insert on public.shoot_invitations to authenticated;

-- INSERT: caller is the shoot's client, shoot is open, target is a real
-- photographer, and not the caller.
create policy "shoot_invitations_insert_client" on public.shoot_invitations
  for insert with check (
    client_id = auth.uid()
    and public.can_invite_to_shoot(shoot_id)
    and photographer_id <> auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = photographer_id and p.role = 'photographer'
    )
  );

-- SELECT: either party to the invitation.
create policy "shoot_invitations_select_party" on public.shoot_invitations
  for select using (
    photographer_id = auth.uid() or client_id = auth.uid()
  );

-- New invitation -> notify the invited photographer.
create or replace function public.notify_shoot_invitation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, type, shoot_id)
  values (new.photographer_id, 'shoot_invitation', new.shoot_id);
  return new;
end;
$$;

create trigger on_shoot_invitation_insert
  after insert on public.shoot_invitations
  for each row execute function public.notify_shoot_invitation();
