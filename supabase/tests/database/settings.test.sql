-- Notification-preference grant scope from 20260622060000_notification_prefs.sql.
-- A user can toggle their own notify_* columns but still cannot touch is_admin
-- (the column-scoped UPDATE grant excludes it).
begin;
create extension if not exists pgtap;

select plan(2);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'setc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Settings Client"}', now(), now());

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000da","role":"authenticated"}';

-- 1: a user can toggle their own notification preference.
select lives_ok(
  $$update public.profiles set notify_bids = false
      where id = '00000000-0000-0000-0000-0000000000da'$$,
  'a user can update their own notification preferences'
);

-- 2: a user cannot grant themselves admin (column not in the UPDATE grant).
select throws_ok(
  $$update public.profiles set is_admin = true
      where id = '00000000-0000-0000-0000-0000000000da'$$,
  '42501',
  null,
  'a user cannot self-grant is_admin'
);
reset role;

select * from finish();
rollback;
