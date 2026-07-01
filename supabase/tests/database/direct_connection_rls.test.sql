-- Direct-connection RLS: a user connecting straight to Supabase (native path)
-- cannot read another user's private rows or write rows they do not own.
begin;
create extension if not exists pgtap;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dc-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"DC Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dc-p1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"DC P1"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dc-p2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"DC P2"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
   'Audit shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-07-01', 2, 500, 900);

-- P1 places a bid via the RPC (their own, legitimate).
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select public.submit_bid('10000000-0000-0000-0000-0000000000e1', 700, 'P1 legitimate bid here.');

-- 1: P2 cannot see P1's bid amount by reading the bids table directly.
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is(
  (select count(*)::int from public.bids
   where shoot_id = '10000000-0000-0000-0000-0000000000e1'
     and photographer_id = '00000000-0000-0000-0000-0000000000e2'),
  0,
  'a rival photographer cannot read another photographer''s bid row'
);

-- 2: P2 cannot forge a bid as P1 (write scoped to auth.uid()).
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-0000000000e1',
            '00000000-0000-0000-0000-0000000000e2', 500, 'Forged bid as P1.')$$,
  '42501',
  null,
  'a photographer cannot insert a bid on behalf of another'
);

-- 3: an authenticated user cannot read the email_outbox at all.
select throws_ok(
  $$select * from public.email_outbox$$,
  '42501',
  null,
  'the email_outbox is not readable by an authenticated user'
);

-- 4: an authenticated user cannot read the audit_log at all.
select throws_ok(
  $$select * from public.audit_log$$,
  '42501',
  null,
  'the audit_log is not readable by an authenticated user'
);

-- 5: P2 (e3) cannot INSERT a photographer_details row on behalf of P1 (e2).
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select throws_ok(
  $$insert into public.photographer_details (profile_id)
    values ('00000000-0000-0000-0000-0000000000e2')$$,
  '42501',
  null,
  'a photographer cannot insert photographer_details for another photographer'
);

-- 6: P2 (e3) cannot INSERT a portfolio_images row for P1 (e2).
select throws_ok(
  $$insert into public.portfolio_images (photographer_id, storage_path)
    values ('00000000-0000-0000-0000-0000000000e2', 'fake/path.jpg')$$,
  '42501',
  null,
  'a photographer cannot insert portfolio_images for another photographer'
);

select * from finish();
rollback;
