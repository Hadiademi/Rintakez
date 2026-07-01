-- submit_bid RPC: a photographer can place a bid, a duplicate live bid is
-- rejected with 'already_bid', and a previously withdrawn bid is revived.
begin;
create extension if not exists pgtap;

select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sb-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"SB Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sb-p@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"SB Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d1',
   'Bid target shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-06-01', 2, 500, 900);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';

-- 1: first bid succeeds and creates a pending row
select lives_ok(
  $$select public.submit_bid('10000000-0000-0000-0000-0000000000d1', 700, 'My first bid, long enough.')$$,
  'photographer can submit a first bid'
);
select is(
  (select status::text from public.bids
   where shoot_id = '10000000-0000-0000-0000-0000000000d1'
     and photographer_id = '00000000-0000-0000-0000-0000000000d2'),
  'pending',
  'the submitted bid is pending'
);

-- 2: a second live bid on the same shoot is rejected
select throws_ok(
  $$select public.submit_bid('10000000-0000-0000-0000-0000000000d1', 800, 'A duplicate live bid here.')$$,
  'P0001',
  'already_bid',
  'a duplicate live bid is rejected with already_bid'
);

-- 3: withdrawing then resubmitting revives the bid at the new amount
update public.bids set status = 'withdrawn'
  where shoot_id = '10000000-0000-0000-0000-0000000000d1'
    and photographer_id = '00000000-0000-0000-0000-0000000000d2';
select public.submit_bid('10000000-0000-0000-0000-0000000000d1', 950, 'Reviving my earlier bid now.');
select is(
  (select amount_chf from public.bids
   where shoot_id = '10000000-0000-0000-0000-0000000000d1'
     and photographer_id = '00000000-0000-0000-0000-0000000000d2'),
  950,
  'a withdrawn bid is revived at the new amount'
);

select * from finish();
rollback;
