-- Terms consent from 20260622070000_terms_consent.sql: handle_new_user stamps
-- terms_accepted_at + terms_version on every new signup.
begin;
create extension if not exists pgtap;

select plan(2);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000ea', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'terms@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Terms User","terms_version":"1.0"}', now(), now());

select isnt(
  (select terms_accepted_at from public.profiles
     where id = '00000000-0000-0000-0000-0000000000ea'),
  null,
  'signup stamps terms_accepted_at on the profile'
);

select is(
  (select terms_version from public.profiles
     where id = '00000000-0000-0000-0000-0000000000ea'),
  '1.0',
  'signup records the terms_version from signup metadata'
);

select * from finish();
rollback;
