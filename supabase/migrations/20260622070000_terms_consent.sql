-- Record Terms-of-Service consent. The signup UI requires accepting the Terms,
-- but acceptance was never persisted (no proof of who accepted which version,
-- when). Store it on the profile, set automatically by the signup trigger for
-- both email and OAuth (Google) signups.
alter table public.profiles
  add column terms_accepted_at timestamptz,
  add column terms_version text;

-- Recreate handle_new_user (last defined in 20260613060000_oauth_role) to also
-- stamp consent, preserving the OAuth role_confirmed logic and name fallbacks.
-- terms_version comes from signup metadata (the app sends the current version);
-- falls back to '1.0'. Acceptance is implied: the email form requires the
-- checkbox and the OAuth screen carries the consent line.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, locale, role_confirmed,
                               terms_accepted_at, terms_version)
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
    (new.raw_user_meta_data ? 'role'),
    now(),
    coalesce(new.raw_user_meta_data ->> 'terms_version', '1.0')
  );
  return new;
end;
$$;

-- Backfill existing accounts: they accepted at signup, so stamp their creation
-- time and the baseline version.
update public.profiles
  set terms_accepted_at = created_at, terms_version = '1.0'
  where terms_accepted_at is null;
