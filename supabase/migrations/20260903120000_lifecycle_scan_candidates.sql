-- Lifecycle scans: move the "already notified" exclusion from TypeScript into
-- SQL, so the batch limit stops being a correctness cliff.
--
-- THE BUG THIS FIXES
-- ------------------
-- Each scan in src/lib/lifecycle.ts fetched candidates with `.limit(100)` and
-- NO ordering, then filtered out already-logged subjects in JavaScript. The
-- filter therefore ran AFTER the limit. Every candidate predicate matches its
-- rows permanently -- a photographer who never onboards stays a candidate
-- forever, and an open shoot with no bids is never auto-closed -- so
-- already-notified subjects accumulate at the front of the heap scan. Once ~100
-- of them exist, every tick returned the same 100 rows, filtered all of them
-- out, and enqueued nothing. New signups silently stopped receiving onboarding
-- reminders; new zero-bid shoots stopped getting rescue emails. Nothing raised:
-- the cron reported `{ onboardingReminder: 0 }`, which is indistinguishable
-- from "nothing to do".
--
-- The fix is an ANTI-JOIN (`not exists`) inside the candidate query plus an
-- explicit `order by` before `limit`, which turns the batch size back into what
-- it was meant to be: a throughput bound, not a correctness bound.
--
-- The suspension and notification-preference filters move in here too. They
-- were three extra round trips per scan in TypeScript; as SQL predicates they
-- cost nothing and cannot drift from the candidate set they filter.
--
-- ACCESS: service-role only, matching lifecycle_email_log and email_outbox
-- (20260701080000 / 20260622040000). Only the cron's admin client calls these.
-- `security definer` so the posture holds even if a future caller arrives with
-- a weaker role; `stable` because they only read.
--
-- NOTE: `lifecycle_email_log` is keyed `primary key (kind, subject_id)`, so
-- every `not exists` below is an index lookup, not a scan.

-- ── onboarding reminder ─────────────────────────────────────────────
-- Photographers who signed up before the cutoff and still have no
-- photographer_details row (i.e. never finished onboarding).
-- Deliberately NOT preference-gated: none of notify_bids /
-- notify_shoot_updates / notify_messages describes "reminders about my own
-- onboarding" -- they are all about other people's activity. Matches the
-- previous behaviour; suspended photographers are still excluded.
create or replace function public.lifecycle_onboarding_candidates(
  p_cutoff timestamptz,
  p_limit integer
)
returns table (profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from profiles p
  where p.role = 'photographer'
    and p.is_suspended = false
    and p.created_at < p_cutoff
    and not exists (
      select 1 from photographer_details d where d.profile_id = p.id
    )
    and not exists (
      select 1 from lifecycle_email_log l
      where l.kind = 'onboarding_reminder' and l.subject_id = p.id
    )
  order by p.created_at
  limit p_limit;
$$;

-- ── zero-bid rescue ─────────────────────────────────────────────────
-- Shoots still 'open' with zero ACTIVE bids since before the cutoff.
-- "Active" excludes 'withdrawn' and 'declined': a shoot whose only bids were
-- withdrawn has, from the client's perspective, nobody bidding, so it must
-- still qualify.
create or replace function public.lifecycle_zero_bid_candidates(
  p_cutoff timestamptz,
  p_limit integer
)
returns table (shoot_id uuid, client_id uuid, title text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.client_id, s.title
  from shoots s
  join profiles c on c.id = s.client_id
  where s.status = 'open'
    and s.created_at < p_cutoff
    and c.is_suspended = false
    and coalesce(c.notify_shoot_updates, true) = true
    and not exists (
      select 1 from bids b
      where b.shoot_id = s.id and b.status in ('pending', 'accepted')
    )
    and not exists (
      select 1 from lifecycle_email_log l
      where l.kind = 'zero_bid_rescue' and l.subject_id = s.id
    )
  order by s.created_at
  limit p_limit;
$$;

-- ── review request ──────────────────────────────────────────────────
-- Shoots completed before the cutoff that still have no review. The window is
-- measured off shoots.completed_at (stamped by complete_shoot()), so a
-- reminder never fires before the shoot has genuinely been done that long.
-- Rows predating that column carry NULL and are excluded by the comparison --
-- a one-time gap for pre-column history, unchanged from the previous scan.
create or replace function public.lifecycle_review_request_candidates(
  p_cutoff timestamptz,
  p_limit integer
)
returns table (shoot_id uuid, client_id uuid, title text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.client_id, s.title
  from shoots s
  join profiles c on c.id = s.client_id
  where s.status = 'completed'
    and s.completed_at < p_cutoff
    and c.is_suspended = false
    and coalesce(c.notify_shoot_updates, true) = true
    and not exists (
      select 1 from reviews r where r.shoot_id = s.id
    )
    and not exists (
      select 1 from lifecycle_email_log l
      where l.kind = 'review_request' and l.subject_id = s.id
    )
  order by s.completed_at
  limit p_limit;
$$;

-- Service-role only. `revoke from public` first: the default grant on a new
-- function is EXECUTE to PUBLIC, so revoking only from anon/authenticated
-- would leave it reachable (the same trap fixed in 20260613010720 FIX 3).
revoke all on function public.lifecycle_onboarding_candidates(timestamptz, integer) from public;
revoke all on function public.lifecycle_zero_bid_candidates(timestamptz, integer) from public;
revoke all on function public.lifecycle_review_request_candidates(timestamptz, integer) from public;

grant execute on function public.lifecycle_onboarding_candidates(timestamptz, integer) to service_role;
grant execute on function public.lifecycle_zero_bid_candidates(timestamptz, integer) to service_role;
grant execute on function public.lifecycle_review_request_candidates(timestamptz, integer) to service_role;
