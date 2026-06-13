-- Google (OAuth) sign-in support. OAuth users arrive with no role, so we let
-- the chosen role (picked on the register page) be applied exactly once on the
-- first login. `role_confirmed` distinguishes a deliberately-chosen role from
-- the OAuth default, and is the guard that keeps the one-time set from being
-- abused to flip roles later.

alter table public.profiles
  add column role_confirmed boolean not null default true;

-- Recreate the signup trigger:
--  • role_confirmed = whether the signup explicitly carried a role
--    (email/password does; OAuth does not).
--  • display_name also falls back to the OAuth-provided full name / name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, locale, role_confirmed)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce((new.raw_user_meta_data ->> 'locale')::public.locale, 'de'),
    (new.raw_user_meta_data ? 'role')
  );
  return new;
end;
$$;

-- One-time role assignment for a fresh OAuth user. No-op once the role is
-- confirmed, so it cannot be used to switch roles afterwards.
create or replace function public.set_initial_role(p_role public.user_role)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles
  set role = p_role, role_confirmed = true
  where id = auth.uid() and role_confirmed = false;
end;
$$;

revoke execute on function public.set_initial_role(public.user_role)
  from anon, public;
grant execute on function public.set_initial_role(public.user_role)
  to authenticated;
