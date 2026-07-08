-- Premium-only platform benchmark: "how does my acceptance rate compare to
-- the platform median?" (subs-P6). The entitlement check lives INSIDE this
-- SQL function (reads photographer_effective_tier for auth.uid()) rather than
-- being enforced only by the client UI, so a UI bypass cannot leak the
-- benchmark to a non-premium caller.
--
-- Privacy: aggregate-only. It never returns any individual photographer's
-- rate — only a platform-wide median — and applies a k-anonymity guard
-- (only photographers with >=3 bids are included in the percentile) so a
-- photographer with very few bids can't be singled out via the aggregate.
create or replace function public.platform_median_acceptance_rate()
returns numeric
language sql stable security definer set search_path = public
as $$
  select case
    when exists (
      select 1 from photographer_effective_tier
      where profile_id = auth.uid() and effective_tier = 'premium'
    ) then (
      with rates as (
        select photographer_id,
          count(*) filter (where status = 'accepted')::numeric / count(*) as rate
        from bids
        group by photographer_id
        having count(*) >= 3   -- k-anonymity / min-sample guard: only photographers with >=3 bids
      )
      select percentile_cont(0.5) within group (order by rate) from rates
    )
    else null
  end;
$$;

revoke all on function public.platform_median_acceptance_rate() from public;
grant execute on function public.platform_median_acceptance_rate() to authenticated;
