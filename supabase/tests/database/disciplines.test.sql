-- Discipline model from 20260622080000_disciplines.sql.
-- Shoots default to photo; a pro must keep ≥1 discipline; a pro can set their own.
begin;
create extension if not exists pgtap;

select plan(3);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'discc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Disc Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'discf@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Disc Photographer"}', now(), now());

insert into public.photographer_details (profile_id) values
  ('00000000-0000-0000-0000-0000000000fa');

-- 1: a shoot defaults to the 'photo' discipline.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000fd', '00000000-0000-0000-0000-0000000000fc',
   'Discipline default', 'portrait', 'Brief long enough.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900);

select is(
  (select discipline::text from public.shoots
     where id = '10000000-0000-0000-0000-0000000000fd'),
  'photo',
  'a shoot defaults to the photo discipline'
);

-- 2: a professional cannot have an empty disciplines array.
select throws_ok(
  $$update public.photographer_details set disciplines = '{}'
      where profile_id = '00000000-0000-0000-0000-0000000000fa'$$,
  '23514',
  null,
  'a professional must keep at least one discipline'
);

-- 3: a professional can set their own disciplines (photo + video).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000fa","role":"authenticated"}';
select lives_ok(
  $$update public.photographer_details set disciplines = '{photo,video}'
      where profile_id = '00000000-0000-0000-0000-0000000000fa'$$,
  'a professional can update their own disciplines'
);
reset role;

select * from finish();
rollback;
