-- Client favorites (saved photographers) and photographer availability
-- (blocked / unavailable dates shown on the public profile).

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photographer_id)
);

alter table public.favorites enable row level security;
grant select, insert, delete on public.favorites to authenticated;

create policy "favorites_select_own" on public.favorites
  for select using (user_id = auth.uid());
create policy "favorites_insert_own" on public.favorites
  for insert with check (user_id = auth.uid());
create policy "favorites_delete_own" on public.favorites
  for delete using (user_id = auth.uid());

create table public.photographer_unavailable (
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  primary key (photographer_id, date)
);

create index photographer_unavailable_idx
  on public.photographer_unavailable (photographer_id, date);

alter table public.photographer_unavailable enable row level security;
grant select on public.photographer_unavailable to anon, authenticated;
grant insert, delete on public.photographer_unavailable to authenticated;

-- Availability is public (clients should see it before reaching out).
create policy "pu_select_all" on public.photographer_unavailable
  for select using (true);
create policy "pu_insert_own" on public.photographer_unavailable
  for insert with check (
    photographer_id = auth.uid() and public.has_role('photographer')
  );
create policy "pu_delete_own" on public.photographer_unavailable
  for delete using (photographer_id = auth.uid());
