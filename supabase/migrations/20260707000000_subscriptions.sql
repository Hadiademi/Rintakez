-- P0 — subscriptions schema + entitlements foundation (spec: subs-P0-brief).
-- No payment code here; this lays the DB schema two later phases build on and
-- closes two pre-existing security holes discovered while designing it.

-- ── a) public.subscriptions — one row per user, service-role-written only ──
create table public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('basic','standard','premium')),
  status text not null check (status in ('active','trialing','past_due','canceled','comp')),
  source text not null check (source in ('stripe','admin_comp')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  comp_until timestamptz,
  granted_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_source_shape check (
    (source = 'admin_comp' and status = 'comp' and comp_until is not null)
    or (source = 'stripe' and status in ('active','trialing','past_due','canceled'))
  )
);
create index subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);
alter table public.subscriptions enable row level security;

grant select on public.subscriptions to authenticated;
create policy "subscriptions_select_own" on public.subscriptions
  for select using (user_id = auth.uid());
-- NO insert/update/delete grants to anon/authenticated: subscriptions are
-- written only by trusted server code (webhooks, admin actions) via the
-- service-role client. 20260613110000_service_role_grants.sql already runs
-- `grant all on all tables in schema public to service_role` AND
-- `alter default privileges ... grant all on tables to service_role`, so this
-- new table is automatically covered — no explicit service_role grant needed.

-- ── b) plan columns on photographer_details ─────────────────────────────
alter table public.photographer_details
  add column plan_tier text not null default 'free' check (plan_tier in ('free','basic','standard','premium')),
  add column plan_expires_at timestamptz;

-- ── c) F1 FIX (SECURITY) ─────────────────────────────────────────────────
-- photographer_details has carried a table-wide INSERT grant since
-- 20260613005248_security.sql:16 (`grant insert, update on
-- photographer_details to authenticated`). UPDATE was later column-scoped by
-- 20260622020000_verification.sql (and further columns added by
-- 20260622080000_disciplines.sql, 20260622110000_cover.sql,
-- 20260630030000_verification_evidence.sql) but INSERT never was — so a
-- photographer's own INSERT (the RLS policy only checks profile_id/role) could
-- carry a client-supplied plan_tier or verification_status. Column-scope
-- INSERT to exactly the 7 columns the onboarding upsert
-- (src/lib/actions/photographer.ts savePhotographerDetails) sends.
revoke insert on public.photographer_details from authenticated;
grant insert (profile_id, specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url, disciplines)
  on public.photographer_details to authenticated;

-- The onboarding upsert uses `onConflict: profile_id`, and PostgREST's
-- generated ON CONFLICT DO UPDATE SET clause includes every submitted column
-- INCLUDING the conflict target itself (`profile_id = excluded.profile_id`).
-- Without UPDATE privilege on profile_id, the conflict-update path 42501s even
-- though the value never actually changes (RLS already pins profile_id =
-- auth.uid() on both the insert and update policies, so this grant cannot be
-- used to reassign a row to someone else — it's a harmless same-value set).
grant update (profile_id) on public.photographer_details to authenticated;

-- ── d) F2 FIX (SECURITY) ─────────────────────────────────────────────────
-- bids has carried a table-wide UPDATE grant since
-- 20260613005248_security.sql:25 (`grant insert, update on bids to
-- authenticated`). App code (src/lib/actions/bids.ts: updateBidAction,
-- withdrawBidAction, and the revive-withdrawn-on-resubmit branch of
-- submitBidAction) only ever writes amount_chf, message, status — so a
-- photographer could otherwise UPDATE their own bid's created_at to dodge the
-- future monthly-quota check. accept_bid/decline_bid are SECURITY DEFINER
-- RPCs and are unaffected by this grant change.
revoke update on public.bids from authenticated;
grant update (amount_chf, message, status) on public.bids to authenticated;

-- ── e) quota-count index ─────────────────────────────────────────────────
-- Only a single-column bids_photographer_idx exists (schema.sql:128); the
-- monthly quota check filters photographer_id + created_at together.
create index bids_photographer_created_idx on public.bids (photographer_id, created_at);

-- ── f) effective-tier view (anti-drift) ──────────────────────────────────
-- The ONE place tier+expiry is computed. All future readers — directory
-- ranking, badges, alert gating, dashboard — must read `effective_tier` from
-- this view, never raw photographer_details.plan_tier directly (an expired
-- plan_expires_at silently means 'free').
create view public.photographer_effective_tier as
  select profile_id,
    case when plan_expires_at is not null and plan_expires_at > now()
         then plan_tier else 'free' end as effective_tier,
    plan_expires_at
  from public.photographer_details;
alter view public.photographer_effective_tier set (security_invoker = true);
grant select on public.photographer_effective_tier to anon, authenticated;

-- ── g) seed trigger (comp/subscribe-before-onboarding drift) ────────────
-- If a user is comped or subscribes before they ever fill in
-- photographer_details, their first INSERT should already reflect the plan
-- they're entitled to (rather than sitting on 'free' until some other write
-- touches plan_tier). The INSERT grant excludes plan columns, so a
-- client-supplied plan_tier still fails 42501 before this trigger runs — the
-- trigger only fills the server-side default.
create or replace function public.set_plan_tier_from_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
declare v record;
begin
  select plan, status, source, current_period_end, comp_until into v
  from subscriptions where user_id = new.profile_id;
  if found then
    if v.source = 'admin_comp' and v.comp_until > now() then
      new.plan_tier := v.plan; new.plan_expires_at := v.comp_until;
    elsif v.source = 'stripe' and v.status in ('active','trialing','past_due')
          and v.current_period_end > now() then
      new.plan_tier := v.plan; new.plan_expires_at := v.current_period_end;
    end if;
  end if;
  return new;
end; $$;
create trigger photographer_details_plan_seed
  before insert on public.photographer_details
  for each row execute function public.set_plan_tier_from_subscription();
