-- RLS is the security boundary (spec §3.8). The anon key is public by design.
-- Helper functions are SECURITY DEFINER to avoid recursive policy evaluation
-- (shoots policies reference bids and vice versa).

alter table public.profiles enable row level security;
alter table public.photographer_details enable row level security;
alter table public.portfolio_images enable row level security;
alter table public.shoots enable row level security;
alter table public.bids enable row level security;

-- ── table-level grants (required for RLS to fire; anon key is public) ──
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

grant select on public.photographer_details to anon, authenticated;
grant insert, update on public.photographer_details to authenticated;

grant select on public.portfolio_images to anon, authenticated;
grant insert, delete on public.portfolio_images to authenticated;

grant select on public.shoots to anon, authenticated;
grant insert, update on public.shoots to authenticated;

grant select on public.bids to anon, authenticated;
grant insert, update on public.bids to authenticated;

-- ── helpers ─────────────────────────────────────────────────────────
create or replace function public.is_shoot_client(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shoots where id = p_shoot_id and client_id = auth.uid()
  );
$$;

create or replace function public.is_accepted_photographer(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from shoots s
    join bids b on b.id = s.accepted_bid_id
    where s.id = p_shoot_id and b.photographer_id = auth.uid()
  );
$$;

create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = p_role
  );
$$;

-- Public bid count per shoot (photographers must not see competitor bids,
-- only the count shown on cards).
create or replace function public.shoot_bid_count(p_shoot_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::int from bids
  where shoot_id = p_shoot_id and status in ('pending', 'accepted');
$$;

-- ── profiles ────────────────────────────────────────────────────────
create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
-- role is immutable in v1: the WITH CHECK pins it to its current value.
-- INSERT happens only via the on_auth_user_created trigger (security definer).

-- ── photographer_details ────────────────────────────────────────────
create policy "photographer_details_select_all" on public.photographer_details
  for select using (true);

create policy "photographer_details_insert_own" on public.photographer_details
  for insert with check (profile_id = auth.uid() and public.has_role('photographer'));

create policy "photographer_details_update_own" on public.photographer_details
  for update using (profile_id = auth.uid());

-- ── portfolio_images ────────────────────────────────────────────────
create policy "portfolio_select_all" on public.portfolio_images
  for select using (true);

create policy "portfolio_insert_own" on public.portfolio_images
  for insert with check (photographer_id = auth.uid() and public.has_role('photographer'));

create policy "portfolio_delete_own" on public.portfolio_images
  for delete using (photographer_id = auth.uid());

-- ── shoots ──────────────────────────────────────────────────────────
create policy "shoots_select" on public.shoots
  for select using (
    status = 'open'
    or client_id = auth.uid()
    or public.is_accepted_photographer(id)
  );

create policy "shoots_insert_client" on public.shoots
  for insert with check (client_id = auth.uid() and public.has_role('client'));

-- Client may edit while open; cancel until completed. Status transitions
-- to assigned/completed happen only via functions below.
create policy "shoots_update_own" on public.shoots
  for update using (client_id = auth.uid() and status in ('open', 'assigned'))
  with check (client_id = auth.uid() and status in ('open', 'cancelled'));

-- ── bids ────────────────────────────────────────────────────────────
create policy "bids_select_own_or_shoot_client" on public.bids
  for select using (
    photographer_id = auth.uid()
    or public.is_shoot_client(shoot_id)
  );

create policy "bids_insert_photographer" on public.bids
  for insert with check (
    photographer_id = auth.uid()
    and public.has_role('photographer')
    and exists (
      select 1 from public.shoots s
      where s.id = shoot_id and s.status = 'open' and s.client_id <> auth.uid()
    )
  );

create policy "bids_update_own_pending" on public.bids
  for update using (photographer_id = auth.uid() and status = 'pending')
  with check (photographer_id = auth.uid() and status in ('pending', 'withdrawn'));

-- ── accept_bid: the one critical transaction (spec §3.7) ───────────
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
  select b.shoot_id, s.client_id
    into v_shoot_id, v_client_id
  from bids b
  join shoots s on s.id = b.shoot_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and s.status = 'open'
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

-- Contact exchange after acceptance (spec §3.8): each party may read the
-- other's email only on an assigned/completed shoot they belong to.
create or replace function public.get_counterparty_email(p_shoot_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shoot shoots%rowtype;
  v_photographer_id uuid;
  v_email text;
begin
  select * into v_shoot from shoots
  where id = p_shoot_id and status in ('assigned', 'completed');

  if not found then
    raise exception 'no contact available';
  end if;

  select photographer_id into v_photographer_id
  from bids where id = v_shoot.accepted_bid_id;

  if auth.uid() = v_shoot.client_id then
    select email into v_email from auth.users where id = v_photographer_id;
  elsif auth.uid() = v_photographer_id then
    select email into v_email from auth.users where id = v_shoot.client_id;
  else
    raise exception 'no contact available';
  end if;

  return v_email;
end;
$$;

-- Functions callable by signed-in users only.
revoke execute on function public.accept_bid(uuid) from anon;
revoke execute on function public.get_counterparty_email(uuid) from anon;

-- ── storage buckets ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('portfolio', 'portfolio', true);

-- Users write only inside their own folder: <uid>/<filename>
create policy "storage_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_delete_own_folder" on storage.objects
  for delete using (
    bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
