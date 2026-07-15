-- WI-1 (security): close the profiles oversharing leak.
--
-- `grant select on public.profiles to anon, authenticated` (20260613005248)
-- is TABLE-WIDE, and `profiles_select_all using (true)` does not filter by
-- row. Combined, any anon caller with the public anon key can enumerate
-- is_admin (every admin account), is_suspended, suspension_reason,
-- suspended_at, notify_bids, notify_shoot_updates, notify_messages,
-- terms_accepted_at and terms_version for every user via PostgREST.
--
-- Fix WITHOUT touching RLS or any embed: column-scope the SELECT grant to a
-- safe public-identity allowlist (closing the leak at the privilege layer,
-- which Postgres enforces regardless of row match), and give the
-- authenticated caller a SECURITY DEFINER function that returns their own
-- full row for the two places that legitimately need it (getProfile's
-- central auth read, and the nDSG/GDPR data export).

-- Own-row full read for the authenticated user (definer bypasses the
-- column-scoped grant below). Used by getProfile + the privacy export.
create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$ select * from public.profiles where id = auth.uid() $$;
revoke all on function public.current_profile() from public;
grant execute on function public.current_profile() to authenticated;

-- Column-scoped SELECT: expose only the public-identity columns to
-- anon/authenticated. is_admin, suspension_reason, suspended_at, notify_bids,
-- notify_shoot_updates, notify_messages, terms_accepted_at, terms_version and
-- role_confirmed become non-selectable by anon/authenticated (closing the
-- enumeration leak) — including for a user's OWN row, which is why
-- current_profile() exists above. is_suspended stays readable (low
-- sensitivity; used throughout to hide suspended users from public queries
-- and to filter the admin users list). The service-role admin client
-- (grant all ... to service_role, 20260613110000) bypasses this entirely and
-- keeps full column access for the admin panel and lifecycle jobs.
revoke select on public.profiles from anon, authenticated;
grant select (id, role, display_name, avatar_url, city, canton, locale, bio, created_at, is_suspended)
  on public.profiles to anon, authenticated;
