-- Data-integrity constraints from 20260622000000_data_integrity.sql (gap A8).
-- Runs as the test superuser (RLS is bypassed) so we exercise the CHECK and FK
-- behaviour directly, independent of policies.
begin;
create extension if not exists pgtap;

select plan(6);

-- ── fixtures: 1 client + 2 photographers + 1 open shoot + 2 bids ────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'c1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Client One"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Photographer One"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Photographer Two"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c1',
   'Constraint test shoot', 'portrait', 'Brief for the constraint test.',
   'Bern', 'BE', '2027-12-01', 2, 500, 900);

-- 1. A bid at the 1'000'000 ceiling is accepted.
select lives_ok(
  $$ insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
     values ('20000000-0000-0000-0000-0000000000b1',
             '10000000-0000-0000-0000-0000000000c1',
             '00000000-0000-0000-0000-0000000000f1', 1000000,
             'At the ceiling, should pass.') $$,
  'bid amount_chf at the 1000000 ceiling is allowed'
);

-- A second bid (different photographer) used by the tamper test below.
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000b2',
   '10000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000f2', 800, 'Second bid for tamper test.');

-- 2. A bid above the ceiling is rejected by bids_amount_max.
select throws_ok(
  $$ insert into public.bids (shoot_id, photographer_id, amount_chf, message)
     values ('10000000-0000-0000-0000-0000000000c1',
             '00000000-0000-0000-0000-0000000000f1', 1000001,
             'Over the ceiling, should fail.') $$,
  '23514',
  null,
  'bid amount_chf above 1000000 is rejected by the CHECK constraint'
);

-- 3. A shoot budget above the ceiling is rejected by shoots_budget_max_ceiling.
select throws_ok(
  $$ insert into public.shoots (client_id, title, type, brief, location_city,
                                canton, shoot_date, duration_hours,
                                budget_min_chf, budget_max_chf)
     values ('00000000-0000-0000-0000-0000000000c1', 'Too rich', 'portrait',
             'Brief that is long enough.', 'Bern', 'BE', '2027-12-02', 2,
             500, 1000001) $$,
  '23514',
  null,
  'shoot budget_max_chf above 1000000 is rejected by the CHECK constraint'
);

-- Assign the shoot to the first bid via the legal open->assigned transition.
update public.shoots
  set status = 'assigned',
      accepted_bid_id = '20000000-0000-0000-0000-0000000000b1'
  where id = '10000000-0000-0000-0000-0000000000c1';

-- 4. accepted_bid_id points at the accepted bid.
select is(
  (select accepted_bid_id from public.shoots
     where id = '10000000-0000-0000-0000-0000000000c1'),
  '20000000-0000-0000-0000-0000000000b1'::uuid,
  'accepted_bid_id points at the accepted bid before deletion'
);

-- 5. Deleting the referenced bid SET NULLs accepted_bid_id (FK + relaxed guard),
--    instead of raising an FK violation or the tamper guard.
delete from public.bids where id = '20000000-0000-0000-0000-0000000000b1';

select is(
  (select accepted_bid_id from public.shoots
     where id = '10000000-0000-0000-0000-0000000000c1'),
  null,
  'accepted_bid_id is SET NULL after the referenced bid is deleted'
);

-- 6. Re-pointing accepted_bid_id at a different bid outside open->assigned is
--    still blocked — the guard relaxation is scoped to NULL-clearing only.
select throws_ok(
  $$ update public.shoots
       set accepted_bid_id = '20000000-0000-0000-0000-0000000000b2'
       where id = '10000000-0000-0000-0000-0000000000c1' $$,
  'P0001',
  'accepted_bid_id is managed by accept_bid',
  'setting accepted_bid_id to a different bid on an assigned shoot is still blocked'
);

select * from finish();
rollback;
