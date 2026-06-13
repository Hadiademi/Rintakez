-- Admin flag for moderation/disputes/metrics. Protected at the column level:
-- users can update only their own editable profile fields, never `is_admin`
-- (or `role`), so the flag cannot be self-granted. It is set out-of-band
-- (SQL / dashboard) by an operator.

alter table public.profiles
  add column is_admin boolean not null default false;

-- Replace the broad UPDATE grant with a column-scoped one. `role`,
-- `role_confirmed`, `is_admin`, `id` are intentionally excluded — they are
-- managed by SECURITY DEFINER functions / operators only.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, city, canton, locale, bio)
  on public.profiles to authenticated;
