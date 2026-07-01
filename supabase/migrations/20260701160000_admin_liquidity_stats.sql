-- Marketplace-liquidity metrics for the owner's admin dashboard: how many open
-- shoots have zero interest, how competitive the ones that do get bids are,
-- how quickly the first bid tends to land, and how much the invite feature
-- (shoot_invitations, 20260701020000) is being used. All four numbers are
-- computed in one SQL round-trip so the medians run inside Postgres rather
-- than being pulled client-side and sorted in JS.
--
-- Access model: this function is granted to service_role ONLY (no
-- authenticated/anon grant). The admin dashboard already reads through
-- createAdminClient() (the service-role client), and that page is itself
-- gated to admins before it renders — so there is no need for an in-function
-- is_admin() check the way the row-level SECURITY DEFINER helpers elsewhere in
-- this codebase have one; the function simply isn't reachable from the
-- anon/authenticated roles at all.
create or replace function public.admin_liquidity_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with open_shoot_bid_counts as (
    -- One row per OPEN shoot, with its count of ACTIVE (pending/accepted) bids.
    -- Declined/withdrawn bids don't represent live marketplace interest, so
    -- they're excluded — mirrors the zero_bid_rescue precedent (C2).
    select
      s.id,
      s.created_at,
      (
        select count(*)
        from bids b
        where b.shoot_id = s.id
          and b.status in ('pending', 'accepted')
      ) as active_bid_count
    from shoots s
    where s.status = 'open'
  ),
  first_bid_hours as (
    -- Hours between an open shoot's creation and its first-ever bid, for
    -- shoots that have at least one bid (any status — the question is "how
    -- long until the first offer arrived", not "how long until an active
    -- one").
    select
      s.id,
      extract(epoch from (min(b.created_at) - s.created_at)) / 3600.0 as hours_to_first_bid
    from shoots s
    join bids b on b.shoot_id = s.id
    where s.status = 'open'
    group by s.id, s.created_at
  )
  select json_build_object(
    'zero_bid_open', (
      select count(*)
      from open_shoot_bid_counts
      where active_bid_count = 0
    ),
    'median_bids_per_open_shoot', (
      select percentile_cont(0.5) within group (order by active_bid_count)
      from open_shoot_bid_counts
    ),
    'median_hours_to_first_bid', (
      select percentile_cont(0.5) within group (order by hours_to_first_bid)
      from first_bid_hours
    ),
    'invites_sent_7d', (
      select count(*)
      from shoot_invitations
      where created_at >= now() - interval '7 days'
    )
  );
$$;

-- service_role only — see access-model comment above. Do NOT grant to
-- authenticated/anon; this aggregates data across every client's shoots and
-- must not be callable from the browser.
revoke all on function public.admin_liquidity_stats() from public;
grant execute on function public.admin_liquidity_stats() to service_role;
