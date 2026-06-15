begin;
create extension if not exists pgtap;

select plan(18);

-- RLS abuse-vector coverage for the messaging and reviews features. The schema
-- migrations shipped these tables but the policy suite never exercised them;
-- these are exactly the surfaces a marketplace gets attacked on:
--   • reading a conversation you are not part of
--   • posting as someone else / into someone else's thread
--   • leaving a review without having actually hired the photographer
--
-- Actors: 1 client (C) + the assigned photographer (P1) + an outsider
-- photographer (P2). Fixtures use a dedicated 'a0' id suffix so seed data,
-- if present, cannot perturb the scoped counts.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client-mr@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Client C"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p1-mr@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Photographer P1"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p2-mr@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Outsider P2"}', now(), now());

-- Three shoots owned by C, each opened then driven through the legal FSM so the
-- accept-side state (accepted_bid_id, conversation) matches production.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
   'Completed shoot', 'portrait', 'Done and dusted.', 'Bern', 'BE', '2027-01-10', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1',
   'Assigned shoot', 'portrait', 'Still upcoming.', 'Bern', 'BE', '2027-02-10', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1',
   'Second completed shoot', 'portrait', 'Also done.', 'Bern', 'BE', '2027-03-10', 2, 500, 900);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a2', 700, 'P1 bid on shoot 1'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000a2', 700, 'P1 bid on shoot 2'),
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a3',
   '00000000-0000-0000-0000-0000000000a2', 700, 'P1 bid on shoot 3');

-- open -> assigned (sets accepted_bid_id; fires the conversation auto-create
-- trigger for shoot 1, creating a thread between C and P1).
update public.shoots set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000a1'
  where id = '10000000-0000-0000-0000-0000000000a1';
update public.shoots set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000a2'
  where id = '10000000-0000-0000-0000-0000000000a2';
update public.shoots set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000a3'
  where id = '10000000-0000-0000-0000-0000000000a3';

-- assigned -> completed for shoots 1 and 3 (shoot 2 stays assigned).
update public.shoots set status = 'completed' where id = '10000000-0000-0000-0000-0000000000a1';
update public.shoots set status = 'completed' where id = '10000000-0000-0000-0000-0000000000a3';

-- Two seed messages in shoot 1's conversation: one from each participant.
insert into public.messages (conversation_id, sender_id, body)
values
  ((select id from public.conversations where shoot_id = '10000000-0000-0000-0000-0000000000a1'),
   '00000000-0000-0000-0000-0000000000a1', 'Hi from the client'),
  ((select id from public.conversations where shoot_id = '10000000-0000-0000-0000-0000000000a1'),
   '00000000-0000-0000-0000-0000000000a2', 'Hi from the photographer');

-- ── 1–3: tables exist ────────────────────────────────────────────────
select has_table('public', 'conversations', 'conversations exists');
select has_table('public', 'messages', 'messages exists');
select has_table('public', 'reviews', 'reviews exists');

-- ── 4: a participant reads the thread they belong to ─────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.messages
    where conversation_id = (select id from public.conversations
                             where shoot_id = '10000000-0000-0000-0000-0000000000a1')$$,
  array[2],
  'assigned photographer reads both messages in their conversation'
);
reset role;

-- ── 5: an outsider cannot read the thread ────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.messages
    where conversation_id = (select id from public.conversations
                             where shoot_id = '10000000-0000-0000-0000-0000000000a1')$$,
  array[0],
  'outsider photographer cannot read a conversation they are not part of'
);
reset role;

-- ── 6: a participant may post a message as themselves ────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations where shoot_id = '10000000-0000-0000-0000-0000000000a1'),
            '00000000-0000-0000-0000-0000000000a1', 'A legitimate reply')$$,
  'client (a participant) can post a message as themselves'
);
reset role;

-- ── 7: an outsider cannot post into a thread ─────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations where shoot_id = '10000000-0000-0000-0000-0000000000a1'),
            '00000000-0000-0000-0000-0000000000a3', 'Let me in')$$,
  '42501',
  null,
  'outsider cannot insert a message into a conversation they are not part of'
);
reset role;

-- ── 8: a participant cannot spoof another user as the sender ─────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ((select id from public.conversations where shoot_id = '10000000-0000-0000-0000-0000000000a1'),
            '00000000-0000-0000-0000-0000000000a2', 'Pretending to be the photographer')$$,
  '42501',
  null,
  'a participant cannot post a message under another users sender_id'
);
reset role;

-- ── 9: an outsider sees none of the fixture conversations ────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from public.conversations
    where shoot_id::text like '10000000-0000-0000-0000-0000000000a%'$$,
  array[0],
  'outsider photographer sees none of the fixture conversations'
);
reset role;

-- ── 10: a participant may update their own read marker ───────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$update public.conversations set client_last_read_at = now()
    where shoot_id = '10000000-0000-0000-0000-0000000000a1'$$,
  'client can update their own last-read marker'
);

-- ── 11: a participant cannot mutate structural columns ───────────────
-- Only the two read-marker columns are granted; touching photographer_id is a
-- column-privilege violation (would let a client reassign the thread).
select throws_ok(
  $$update public.conversations set photographer_id = '00000000-0000-0000-0000-0000000000a3'
    where shoot_id = '10000000-0000-0000-0000-0000000000a1'$$,
  '42501',
  null,
  'a participant cannot reassign a conversation (no column grant)'
);
reset role;

-- ── 12: the owning client may review a completed shoot ───────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating, comment)
    values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', 5, 'Great work')$$,
  'owning client can review the assigned photographer on a completed shoot'
);

-- ── 13: a shoot can only be reviewed once ────────────────────────────
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', 4)$$,
  '23505',
  null,
  'a second review for the same shoot is blocked by the unique constraint'
);

-- ── 14: a shoot that is not completed cannot be reviewed ─────────────
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', 5)$$,
  '42501',
  null,
  'an assigned (not completed) shoot cannot be reviewed'
);

-- ── 15: cannot review a photographer who was not the one assigned ────
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a3', 5)$$,
  '42501',
  null,
  'client cannot review a photographer who was not assigned to the shoot'
);

-- ── 16: rating must be within 1..5 ───────────────────────────────────
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', 6)$$,
  '23514',
  null,
  'a rating outside 1..5 is rejected by the check constraint'
);
reset role;

-- ── 17: a non-client cannot fabricate a review as someone else ───────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating)
    values ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', 1)$$,
  '42501',
  null,
  'a third party cannot insert a review under the client''s id'
);
reset role;

-- ── 18: reviews are publicly readable ────────────────────────────────
set local role anon;
select results_eq(
  $$select count(*)::int from public.reviews
    where shoot_id = '10000000-0000-0000-0000-0000000000a1'$$,
  array[1],
  'anonymous visitors can read public reviews'
);
reset role;

select * from finish();
rollback;
