begin;
create extension if not exists pgtap;

select plan(6);

-- Photographer replies to a review (task S2.4). A photographer may set a single
-- public reply on a review left about them, and only about them. The settable-
-- once guarantee is enforced at the RLS layer: the UPDATE policy's USING clause
-- gates on the OLD row (`reply is null`), so a row that already carries a reply
-- is filtered out of the UPDATE entirely — a second reply affects 0 rows.
--
-- Actors: 1 client (C) + the assigned photographer (P1) + an outsider
-- photographer (P2). A dedicated 'b' id suffix keeps these fixtures clear of
-- both the seed data and the 'a' fixtures used by messaging_reviews.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client-rr@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Client C"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p1-rr@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Photographer P1"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2-rr@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Outsider P2"}', now(), now());

-- Two shoots owned by C, each driven through the legal FSM to completed with P1
-- as the assigned photographer. R1 exercises the settable-once path; R2 stays
-- reply-less so the actor checks (P2, client) are isolated from that gate.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1',
   'Completed shoot 1', 'portrait', 'Done and dusted.', 'Bern', 'BE', '2027-01-10', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1',
   'Completed shoot 2', 'portrait', 'Also done and dusted.', 'Bern', 'BE', '2027-02-10', 2, 500, 900);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b2', 700, 'P1 bid on shoot 1'),
  ('20000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000b2', 700, 'P1 bid on shoot 2');

update public.shoots set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000b1'
  where id = '10000000-0000-0000-0000-0000000000b1';
update public.shoots set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000b2'
  where id = '10000000-0000-0000-0000-0000000000b2';
update public.shoots set status = 'completed'
  where id in ('10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b2');

insert into public.reviews (id, shoot_id, client_id, photographer_id, rating, comment)
values
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 5, 'Great work'),
  ('30000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000b2',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', 4, 'Solid');

-- ── 1–2: the reply columns exist ─────────────────────────────────────
select has_column('public', 'reviews', 'reply', 'reviews.reply exists');
select has_column('public', 'reviews', 'reply_at', 'reviews.reply_at exists');

-- ── 3: the reviewed photographer replies to their own review (success) ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select results_eq(
  $$with u as (
      update public.reviews set reply = 'Thank you, it was a pleasure.', reply_at = now()
      where id = '30000000-0000-0000-0000-0000000000b1'
      returning 1
    ) select count(*)::int from u$$,
  array[1],
  'the reviewed photographer can set a reply on their own review'
);

-- ── 4: a second reply is blocked (settable once, RLS USING gates OLD row) ─
select results_eq(
  $$with u as (
      update public.reviews set reply = 'Actually, let me add more.', reply_at = now()
      where id = '30000000-0000-0000-0000-0000000000b1'
      returning 1
    ) select count(*)::int from u$$,
  array[0],
  'a second reply is blocked once a reply already exists'
);
reset role;

-- ── 5: a different photographer cannot reply to someone elses review ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select results_eq(
  $$with u as (
      update public.reviews set reply = 'Not my review but here I am.', reply_at = now()
      where id = '30000000-0000-0000-0000-0000000000b2'
      returning 1
    ) select count(*)::int from u$$,
  array[0],
  'an outsider photographer cannot reply to a review about someone else'
);
reset role;

-- ── 6: the reviewing client cannot reply ─────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select results_eq(
  $$with u as (
      update public.reviews set reply = 'I am the client, not the photographer.', reply_at = now()
      where id = '30000000-0000-0000-0000-0000000000b2'
      returning 1
    ) select count(*)::int from u$$,
  array[0],
  'the reviewing client cannot post a reply (they are not the photographer)'
);
reset role;

select * from finish();
rollback;
