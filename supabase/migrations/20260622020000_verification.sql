-- Tier A (A2) — photographer verification (KYC), badge + filter approach.
-- Photographers carry a verification status an admin approves. Verified status
-- is a trust signal: a badge on profiles/cards and a "verified only" directory
-- filter. Bidding is intentionally NOT gated on verification, so marketplace
-- liquidity and existing flows are unaffected.

create type public.verification_status as enum
  ('unverified', 'pending', 'verified', 'rejected');

alter table public.photographer_details
  add column verification_status public.verification_status
    not null default 'unverified';

-- Photographers edit their own profile fields but must NOT self-set
-- verification_status. Column-scope the UPDATE grant to the editable fields
-- (the onboarding/profile upsert touches exactly these); verification_status is
-- changed only by request_verification() (-> 'pending') or by an admin.
revoke update on public.photographer_details from authenticated;
grant update (specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url)
  on public.photographer_details to authenticated;

-- A photographer requests verification for their own row (no-op unless currently
-- unverified or previously rejected).
create or replace function public.request_verification()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.photographer_details
    set verification_status = 'pending'
  where profile_id = auth.uid()
    and verification_status in ('unverified', 'rejected');
end;
$$;

revoke execute on function public.request_verification() from public;
grant execute on function public.request_verification() to authenticated;
