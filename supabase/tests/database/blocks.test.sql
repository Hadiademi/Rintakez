-- User block/mute from 20260622030000_blocks.sql (gap A3).
-- A blocked user cannot message the blocker; unblocking restores it; blocked_by()
-- reports the reverse direction; self-blocks are rejected.
begin;
create extension if not exists pgtap;

select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'blkc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Block Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'blkf@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Block Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000bd', '00000000-0000-0000-0000-0000000000ba',
   'Block test shoot', 'portrait', 'Brief for the block test.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900);

insert into public.conversations (id, shoot_id, client_id, photographer_id)
values
  ('30000000-0000-0000-0000-0000000000bc', '10000000-0000-0000-0000-0000000000bd',
   '00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000bb');

-- Client blocks the photographer.
insert into public.user_blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-0000000000ba', '00000000-0000-0000-0000-0000000000bb');

-- ── 1: the blocked photographer cannot message the blocker ───────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('30000000-0000-0000-0000-0000000000bc',
            '00000000-0000-0000-0000-0000000000bb', 'Blocked message.')$$,
  '42501',
  null,
  'a blocked user cannot message the blocker'
);

-- ── 2: blocked_by reports the block to the blocked user ──────────────
select results_eq(
  $$select public.blocked_by('00000000-0000-0000-0000-0000000000ba')$$,
  array[true],
  'blocked_by() is true for the blocked user'
);
reset role;

-- Lift the block.
delete from public.user_blocks
  where blocker_id = '00000000-0000-0000-0000-0000000000ba'
    and blocked_id = '00000000-0000-0000-0000-0000000000bb';

-- ── 3: after unblocking, the photographer can message again ──────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('30000000-0000-0000-0000-0000000000bc',
            '00000000-0000-0000-0000-0000000000bb', 'Now allowed.')$$,
  'after unblocking, the user can message again'
);

-- ── 4: a self-block is rejected by the check constraint ──────────────
select throws_ok(
  $$insert into public.user_blocks (blocker_id, blocked_id)
    values ('00000000-0000-0000-0000-0000000000bb',
            '00000000-0000-0000-0000-0000000000bb')$$,
  '23514',
  null,
  'a user cannot block themselves'
);
reset role;

select * from finish();
rollback;
