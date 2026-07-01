-- shoot_invitations: a client can invite a photographer to their own OPEN shoot,
-- which notifies the photographer; duplicates and invalid targets are refused.
begin;
create extension if not exists pgtap;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Inv Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-p@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Inv Photographer"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-c2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Other Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-c3@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Suspended Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-p2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Blocking Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1',
   'Invite target shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-09-01', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f4',
   'Suspended client shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-09-02', 2, 500, 900),
  ('10000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f1',
   'Blocked invite shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-09-03', 2, 500, 900);

-- Act as the shoot's client.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

-- 1: client can invite a photographer to their own open shoot
select lives_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  'client can invite a photographer to their own open shoot'
);

-- 2: the invited photographer got a shoot_invitation notification
-- (checked as postgres/superuser so the select is not filtered by RLS)
reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000f2'
     and type = 'shoot_invitation'
     and shoot_id = '10000000-0000-0000-0000-0000000000f1'),
  1,
  'the invited photographer receives a shoot_invitation notification'
);
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

-- 3: a duplicate invite is rejected by the unique constraint
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '23505',
  null,
  'a duplicate invite is rejected'
);

-- 4: inviting a non-photographer (a client) is refused by RLS
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f3',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'inviting a non-photographer is refused'
);

-- 5: a different client cannot invite on someone else's shoot
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f3')$$,
  '42501',
  null,
  'a non-owner cannot invite on another client''s shoot'
);

-- 6: the invited photographer can see the invitation row (select party)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select is(
  (select count(*)::int from public.shoot_invitations
   where shoot_id = '10000000-0000-0000-0000-0000000000f1'
     and photographer_id = '00000000-0000-0000-0000-0000000000f2'),
  1,
  'the invited photographer can read their invitation'
);
reset role;

-- Suspend the client who owns the second shoot.
update public.profiles set is_suspended = true
  where id = '00000000-0000-0000-0000-0000000000f4';

-- 7: a SUSPENDED client cannot invite a photographer
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f4","role":"authenticated"}';
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f4')$$,
  '42501',
  null,
  'a suspended client cannot invite a photographer'
);
reset role;

-- The target photographer (F5) blocks the client (F1).
insert into public.user_blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000f1');

-- 8: a client cannot invite a photographer who has blocked them
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f3',
            '00000000-0000-0000-0000-0000000000f5',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'a client cannot invite a photographer who has blocked them'
);
reset role;

select * from finish();
rollback;
