-- "Who viewed you" — the premium tier's flagship insight.
--
-- Standard already sees HOW OFTEN it was viewed (photographer_view_count);
-- premium additionally sees WHO — but privacy-gated (revFADP):
--   * Named rows are ONLY clients who currently have an open shoot. Having an
--     open request is active market participation — surfacing "this client
--     with an open job looked at you" is the marketplace doing its matching
--     job, not surveillance. Their newest open shoot rides along so the
--     photographer can act (view + bid) in one tap.
--   * Everyone else stays an aggregate number in the UI (total views minus
--     the named ones) — never named: no anon visitors, no window-shopping
--     clients without an open request, no competitor photographers.
--   * Caller entitlement is re-checked HERE (security definer + effective
--     tier), mirroring platform_median_acceptance_rate — a UI bypass yields
--     zero rows, not an error.
create or replace function public.premium_profile_viewers(p_since date)
returns table (
  viewer_name text,
  viewer_city text,
  view_count bigint,
  last_view date,
  shoot_id uuid,
  shoot_title text
)
language sql stable security definer set search_path = public
as $$
  select
    p.display_name,
    p.city,
    count(*)::bigint,
    max(v.viewed_on),
    s.id,
    s.title
  from profile_views v
  join profiles p
    on p.id = v.viewer_id
   and p.role = 'client'
   and p.is_suspended = false
  join lateral (
    select sh.id, sh.title
    from shoots sh
    where sh.client_id = p.id
      and sh.status = 'open'
    order by sh.created_at desc
    limit 1
  ) s on true
  where v.photographer_id = auth.uid()
    and v.viewed_on >= p_since
    and exists (
      select 1 from photographer_effective_tier
      where profile_id = auth.uid() and effective_tier = 'premium'
    )
  group by p.id, p.display_name, p.city, s.id, s.title
  order by max(v.viewed_on) desc
  limit 10;
$$;

grant execute on function public.premium_profile_viewers(date) to authenticated;
