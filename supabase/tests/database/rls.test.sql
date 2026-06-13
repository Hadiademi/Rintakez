begin;
create extension if not exists pgtap;

select plan(16);

-- ── fixtures: 1 client + 2 photographers (trigger creates profiles) ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Lena K."}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marko@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Marko B."}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'anna@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Anna S."}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Hochzeit in Zermatt', 'wedding', 'Dokumentarischer Stil, Bergkapelle.',
   'Zermatt', 'VS', '2027-08-14', 10, 3200, 4500);

-- A cancelled shoot that must be invisible to others
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, status)
values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Abgesagter Termin', 'portrait', 'Wird nicht stattfinden.',
   'Bern', 'BE', '2027-09-01', 2, 500, 800, 'cancelled');

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002', 3800, 'Ruhiger dokumentarischer Stil.'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003', 4200, 'Editorial und ehrlich.');

-- ── 1–5: tables exist ────────────────────────────────────────────────
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'photographer_details', 'photographer_details exists');
select has_table('public', 'portfolio_images', 'portfolio_images exists');
select has_table('public', 'shoots', 'shoots exists');
select has_table('public', 'bids', 'bids exists');

-- ── 6: anon sees only open shoots ────────────────────────────────────
set local role anon;
select results_eq(
  'select count(*)::int from public.shoots',
  array[1],
  'anon sees only the open shoot, not the cancelled one'
);
reset role;

-- ── 7: photographer Anna cannot see Markos bid ──────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select results_eq(
  'select count(*)::int from public.bids',
  array[1],
  'photographer sees only her own bid'
);
reset role;

-- ── 8: client sees both bids on own shoot ────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  'select count(*)::int from public.bids',
  array[2],
  'client sees all bids on own shoot'
);

-- ── 9: client cannot insert a bid (wrong role) ──────────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001', 1000, 'Ich biete mit.')$$,
  '42501',
  null,
  'client role cannot bid'
);
reset role;

-- ── 10: photographer cannot bid on a non-open shoot ─────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000002', 600, 'Biete trotzdem.')$$,
  '42501',
  null,
  'cannot bid on cancelled shoot'
);

-- ── 11: duplicate bid blocked by unique constraint ───────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', 3900, 'Zweites Angebot.')$$,
  '23505',
  null,
  'one bid per photographer per shoot'
);

-- ── 12: photographer cannot accept a bid ─────────────────────────────
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not your shoot',
  'only the shoot client can accept'
);
reset role;

-- ── 13–16: owner accepts → full state transition ─────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-000000000001')$$,
  'client accepts Markos bid'
);

select results_eq(
  $$select status::text from public.bids where id = '20000000-0000-0000-0000-000000000001'$$,
  array['accepted'],
  'accepted bid is accepted'
);

select results_eq(
  $$select status::text from public.bids where id = '20000000-0000-0000-0000-000000000002'$$,
  array['declined'],
  'sibling pending bid auto-declined'
);

select results_eq(
  $$select status::text || ':' || accepted_bid_id::text
    from public.shoots where id = '10000000-0000-0000-0000-000000000001'$$,
  array['assigned:20000000-0000-0000-0000-000000000001'],
  'shoot assigned with accepted_bid_id set'
);
reset role;

select * from finish();
rollback;
