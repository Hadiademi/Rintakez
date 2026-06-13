-- Reviews & ratings. A client may review the photographer once per shoot, only
-- after the shoot is completed. Ratings are public (they build trust and power
-- the "recommended photographers" section).

-- Mark an assigned shoot as completed. The client cannot do this via RLS
-- (shoots WITH CHECK forbids the 'completed' target), so it goes through this
-- SECURITY DEFINER function — mirroring accept_bid.
create or replace function public.complete_shoot(p_shoot_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update shoots set status = 'completed'
  where id = p_shoot_id and client_id = auth.uid() and status = 'assigned';
  if not found then
    raise exception 'cannot complete shoot' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.complete_shoot(uuid) from anon, public;
grant execute on function public.complete_shoot(uuid) to authenticated;

-- ── reviews ──────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null unique references public.shoots (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);

create index reviews_photographer_idx on public.reviews (photographer_id);

alter table public.reviews enable row level security;

grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

-- Ratings are public.
create policy "reviews_select_all" on public.reviews
  for select using (true);

-- Only the owning client may review, only on a completed shoot, and the
-- photographer must be the one who was actually assigned to that shoot.
create policy "reviews_insert_client" on public.reviews
  for insert with check (
    client_id = auth.uid()
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

-- ── aggregate view ───────────────────────────────────────────────────
create view public.photographer_ratings as
  select
    photographer_id,
    round(avg(rating), 2)::float8 as avg_rating,
    count(*)::int as review_count
  from public.reviews
  group by photographer_id;

grant select on public.photographer_ratings to anon, authenticated;
