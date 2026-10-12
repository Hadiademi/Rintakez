-- Fail fast instead of queueing behind live traffic if a lock is contended.
set local lock_timeout = '5s';

-- DB hardening: limits that only the server actions enforced, now enforced by
-- the database as well, so a signed-in user calling PostgREST directly gets
-- the same answer as the app. From the 2026-10-10 review.
--
-- All checks apply to writes executing as the `authenticated` database role,
-- i.e. a signed-in user through the API (PostgREST switches to it with SET
-- LOCAL ROLE). They read the role setting rather than auth.role(): the JWT
-- claims can outlive a role switch, while the role setting is what actually
-- holds the user's privileges. Writes by postgres / the service role (cron,
-- webhook, admin tooling, seeds, tests) are trusted and not limited.

-- ── 1. Monthly bid quota (SEC-04) ───────────────────────────────────────
-- The quota was checked only in submitBidAction, so a Free photographer could
-- POST bids to /rest/v1/bids without limit (the paid plans' core value).
--
-- bid_quota_limit() mirrors effectivePlan() + MONTHLY_BID_QUOTA in
-- src/lib/billing exactly, reading the same source of truth (subscriptions):
--   stripe     entitled while status in (active, trialing, past_due) and
--              current_period_end > now()
--   admin_comp entitled while comp_until > now()
--   otherwise  free
-- Limits: free 1, basic 5, standard 32, premium unlimited (null).
-- Keep both in step: src/lib/billing/plans.ts is the app-side copy.
create or replace function public.bid_quota_limit(p_photographer uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case coalesce((
           select s.plan
           from subscriptions s
           where s.user_id = p_photographer
             and (
               (s.source = 'stripe'
                and s.status in ('active', 'trialing', 'past_due')
                and s.current_period_end > now())
               or (s.source = 'admin_comp' and s.comp_until > now())
             )
         ), 'free')
           when 'free' then 1
           when 'basic' then 5
           when 'standard' then 32
           else null
         end;
$$;

-- Runs AFTER the row is written, so RLS (shoot open, own row), the
-- one-bid-per-shoot constraint and every other validity check answer first,
-- exactly as before; the quota is the last gate. Counts every bid this
-- Zurich-calendar month (withdrawn included, like getBidQuotaUsage:
-- submit-withdraw-resubmit must not dodge the cap). An advisory lock per
-- photographer serialises concurrent submits; AFTER row triggers see every
-- row of their statement, so a bulk insert is refused as a whole.
create or replace function public.enforce_bid_quota()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    return null;
  end if;
  if tg_op = 'UPDATE' and not (old.status = 'withdrawn' and new.status = 'pending') then
    return null;
  end if;

  v_limit := bid_quota_limit(new.photographer_id);
  if v_limit is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bid_quota:' || new.photographer_id::text, 0));
  select count(*) into v_used
  from bids
  where photographer_id = new.photographer_id
    and created_at >= (date_trunc('month', now() at time zone 'Europe/Zurich') at time zone 'Europe/Zurich');

  -- A new bid is already in the count, so it may not push it past the limit.
  -- Reviving a withdrawn bid adds no row; like the app's pre-check, it is
  -- refused once the month's bids have reached the limit.
  if (tg_op = 'INSERT' and v_used > v_limit) or (tg_op = 'UPDATE' and v_used >= v_limit) then
    raise exception 'quota_reached' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create trigger bids_enforce_quota
  after insert or update of status on public.bids
  for each row execute function public.enforce_bid_quota();

revoke all on function public.bid_quota_limit(uuid) from public, anon, authenticated;
revoke all on function public.enforce_bid_quota() from public, anon, authenticated;

-- ── 2. Report throttle + one pending admin alert per admin (SEC-07) ─────
-- One POST of thousands of rows used to enqueue one admin email per report
-- per admin; at the drain's pace that blocked every transactional email for
-- days. The throttle mirrors the action's rateLimit (10 per hour).
create or replace function public.enforce_report_rate()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_recent integer;
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    return new;
  end if;
  -- Someone else's reporter_id is refused by RLS; don't answer with a count
  -- of that person's recent reports first.
  if new.reporter_id is distinct from auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('report_rate:' || new.reporter_id::text, 0));
  select count(*) into v_recent
  from reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger reports_enforce_rate
  before insert on public.reports
  for each row execute function public.enforce_report_rate();

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);

revoke all on function public.enforce_report_rate() from public, anon, authenticated;

-- The alert email is generic ("new item in the admin queue"), so one pending
-- alert per admin carries the same information as a hundred.
create or replace function public.notify_admins_on_report()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.email_outbox (recipient_id, kind, shoot_id, shoot_title)
  select p.id, 'admin_alert', null, null
  from public.profiles p
  where p.is_admin = true
    and not exists (
      select 1 from public.email_outbox o
      where o.recipient_id = p.id and o.kind = 'admin_alert' and o.status = 'pending'
    );
  return new;
end;
$$;

create or replace function public.notify_admins_on_dispute()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.email_outbox (recipient_id, kind, shoot_id, shoot_title)
  select p.id, 'admin_alert', null, null
  from public.profiles p
  where p.is_admin = true
    and not exists (
      select 1 from public.email_outbox o
      where o.recipient_id = p.id and o.kind = 'admin_alert' and o.status = 'pending'
    );
  return new;
end;
$$;

-- ── 3. Storage: 5 MB, images only (SEC-09) ─────────────────────────────
-- Buckets had no limits, so the storage API (direct, bypassing the actions)
-- accepted 50 MB files of any type, e.g. HTML phishing pages in the public
-- buckets. Limits match the actions (5 MB, image/*) and include the formats
-- phones produce when the browser cannot re-encode (HEIC/HEIF/AVIF). SVG is
-- deliberately excluded (it can carry script). src/lib/uploads.ts is the
-- app-side copy; uploads.test.ts fails if the two lists drift apart.
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp',
                               'image/gif', 'image/heic', 'image/heif', 'image/avif']
where id in ('avatars', 'portfolio', 'shoot-refs', 'message-images');

-- ── 4. Verification evidence is private (SEC-06) ───────────────────────
-- photographer_details had a table-level SELECT grant, so anyone with the
-- public anon key could read every verification_note (links to ID scans or
-- registry extracts). SELECT is now column-scoped to everything else. Only
-- admin pages (service role) and the owner (my_verification_note(), for the
-- data export) read the note. New columns on this table are therefore NOT
-- readable until granted here.
revoke select on public.photographer_details from anon, authenticated;
grant select (profile_id, specialties, coverage_cantons, hourly_rate_chf, website_url,
              instagram_url, created_at, verification_status, disciplines, cover_path,
              plan_tier, plan_expires_at)
  on public.photographer_details to anon, authenticated;

create or replace function public.my_verification_note()
returns text
language sql stable security definer set search_path = public
as $$
  select verification_note from photographer_details where profile_id = auth.uid();
$$;

revoke all on function public.my_verification_note() from public, anon;
grant execute on function public.my_verification_note() to authenticated;
