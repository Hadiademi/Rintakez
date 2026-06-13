-- Shoot reference images: optional inspiration photos a client attaches to a
-- shoot brief so photographers understand the desired style. Mirrors the
-- portfolio_images pattern (own-folder storage + hard cap via trigger).

create table public.shoot_images (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index shoot_images_shoot_idx on public.shoot_images (shoot_id);

-- Hard cap: 6 reference images per shoot.
create or replace function public.enforce_shoot_image_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.shoot_images
      where shoot_id = new.shoot_id) >= 6 then
    raise exception 'shoot image limit reached (6 images)';
  end if;
  return new;
end;
$$;

create trigger shoot_image_limit
  before insert on public.shoot_images
  for each row execute function public.enforce_shoot_image_limit();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.shoot_images enable row level security;

grant select on public.shoot_images to anon, authenticated;
grant insert, delete on public.shoot_images to authenticated;

-- SECURITY DEFINER helper mirroring shoots_select visibility, so the image
-- policy does not re-trigger shoots RLS inside its own subquery.
create or replace function public.can_view_shoot(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shoots s
    where s.id = p_shoot_id
      and (
        s.status = 'open'
        or s.client_id = auth.uid()
        or exists (
          select 1 from bids b
          where b.id = s.accepted_bid_id and b.photographer_id = auth.uid()
        )
      )
  );
$$;

-- Visible whenever the parent shoot is visible to the viewer.
create policy "shoot_images_select" on public.shoot_images
  for select using (public.can_view_shoot(shoot_id));

-- Only the owning client may attach images.
create policy "shoot_images_insert_owner" on public.shoot_images
  for insert with check (public.is_shoot_client(shoot_id));

-- Only the owning client may remove them.
create policy "shoot_images_delete_owner" on public.shoot_images
  for delete using (public.is_shoot_client(shoot_id));

-- ── storage bucket ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('shoot-refs', 'shoot-refs', true);

-- Uploads live under <uid>/<shootId>/<file>; the first folder pins ownership.
create policy "storage_insert_shootrefs_own" on storage.objects
  for insert with check (
    bucket_id = 'shoot-refs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_delete_shootrefs_own" on storage.objects
  for delete using (
    bucket_id = 'shoot-refs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
