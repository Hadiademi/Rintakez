-- Profile-view collection for a future (payment-gated) photographer analytics
-- dashboard. This migration only collects data + exposes a read seam for the
-- OWNER — there is no dashboard UI yet (that is a later, billed task). Getting
-- collection running now means the dashboard launches with real history
-- instead of starting from zero.
--
-- Privacy (Swiss/DSG): we store only a viewer FK (nullable, for anon) + the
-- photographer FK + a date. No IP, no user agent, no raw timestamp precision
-- beyond created_at (kept for potential future ordering, not exposed as PII).
create table public.profile_views (
  id bigint generated always as identity primary key,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Daily dedupe for logged-in viewers only: repeat views by the same signed-in
-- user on the same day collapse into one row. Anonymous views (viewer_id is
-- null) are intentionally NOT deduped — we can't distinguish anon visitors
-- from each other, and that's an accepted trade-off (see task spec).
create unique index profile_views_daily_uniq
  on public.profile_views (photographer_id, viewer_id, viewed_on)
  where viewer_id is not null;

-- Read pattern for the future dashboard: "views for photographer X over time".
create index profile_views_photographer_date_idx
  on public.profile_views (photographer_id, viewed_on);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.profile_views enable row level security;

-- No INSERT grant to anon/authenticated: rows are only ever created by the
-- SECURITY DEFINER record_profile_view() RPC below, so the client cannot
-- forge or spam arbitrary view rows for other photographers.
grant select on public.profile_views to authenticated;

-- A photographer may read only their own view rows. Nobody reads anyone
-- else's (no policy for that case → denied by default with RLS enabled).
create policy "profile_views_select_own" on public.profile_views
  for select using (photographer_id = auth.uid());

-- ── record_profile_view ──────────────────────────────────────────────
-- Called from the photographer profile page for every non-owner view (both
-- anonymous and logged-in). SECURITY DEFINER so it can insert despite there
-- being no direct INSERT grant. viewer_id is auth.uid(), which is null for
-- anon callers — the daily-dedupe partial unique index only applies when
-- viewer_id is not null, so anon inserts are never deduped/blocked.
create or replace function public.record_profile_view(p_photographer_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Skip self-views: a photographer browsing their own profile shouldn't
  -- inflate their own view count.
  if auth.uid() = p_photographer_id then
    return;
  end if;

  -- Only record views of actual photographer profiles.
  if not exists (
    select 1 from profiles
    where id = p_photographer_id and role = 'photographer'
  ) then
    return;
  end if;

  insert into profile_views (photographer_id, viewer_id)
  values (p_photographer_id, auth.uid())
  on conflict do nothing;
end;
$$;

grant execute on function public.record_profile_view(uuid) to anon, authenticated;

-- ── photographer_view_count ──────────────────────────────────────────
-- Aggregate reader seam for the future dashboard. Owner-only: returns 0 for
-- any caller other than the photographer themselves (mirrors the RLS select
-- policy above, but as a callable aggregate so the dashboard doesn't need to
-- pull raw rows).
create or replace function public.photographer_view_count(
  p_photographer_id uuid,
  p_since date default null
)
returns int
language sql stable security definer set search_path = public
as $$
  select case
    -- auth.uid() is null for anon callers, and null <> x is null (not true),
    -- so this is phrased as "only when it IS the owner" rather than negated,
    -- to avoid leaking the count to anon/other callers via a null comparison.
    when auth.uid() is not distinct from p_photographer_id then (
      select count(*)::int
      from profile_views
      where photographer_id = p_photographer_id
        and (p_since is null or viewed_on >= p_since)
    )
    else 0
  end;
$$;

grant execute on function public.photographer_view_count(uuid, date) to authenticated;
