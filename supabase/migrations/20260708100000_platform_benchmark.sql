-- Premium-only platform benchmark: "how does my acceptance rate compare to
-- the platform median?" (subs-P6). The entitlement check lives INSIDE this
-- SQL function (reads photographer_effective_tier for auth.uid()) rather than
-- being enforced only by the client UI, so a UI bypass cannot leak the
-- benchmark to a non-premium caller.
--
-- Privacy: aggregate-only. It never returns any individual photographer's
-- rate — only a platform-wide median — and applies TWO k-anonymity guards:
-- (1) only photographers with >=3 bids contribute a rate to the pool, and
-- (2) the median is only computed (and returned) when >=3 photographers
-- actually contribute a rate; otherwise NULL is returned. Guard (2) is
-- required because percentile_cont(0.5) over a single-row pool just returns
-- that one photographer's exact rate — without it, guard (1) alone would
-- still leak an individual's rate whenever only one photographer qualifies.
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
        having count(*) >= 3   -- k-anonymity guard 1: only photographers with >=3 bids contribute
      )
      select case
        when (select count(*) from rates) >= 3  -- k-anonymity guard 2: need >=3 contributing photographers
        then (select percentile_cont(0.5) within group (order by rate) from rates)
        else null
      end
    )
    else null
  end;
$$;

revoke all on function public.platform_median_acceptance_rate() from public;
grant execute on function public.platform_median_acceptance_rate() to authenticated;
