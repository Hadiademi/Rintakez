-- Shoot edit grant from 20260622090000_shoot_edit_grant.sql: a client can edit
-- the detail columns of their own OPEN shoot.
begin;
create extension if not exists pgtap;

select plan(1);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'edc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Edit Client"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e1',
   'Original title', 'portrait', 'Brief long enough.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select lives_ok(
  $$update public.shoots set title = 'Edited title', budget_max_chf = 1200
      where id = '10000000-0000-0000-0000-0000000000e2'$$,
  'a client can edit the detail columns of their own open shoot'
);
reset role;

select * from finish();
rollback;
