-- 20261012120000_insert_grants_hardening.sql: a signed-in user may INSERT only
-- the columns the app's own server actions write. 20261008120000 narrowed
-- UPDATE but left Supabase's table-level INSERT grant in place, so a client
-- could create a shoot that was already 'completed' with any visible bid as
-- accepted_bid_id (fake reviews, bidder email without accepting), write a
-- photographer's "reply" inside their own review, file a pre-resolved dispute,
-- backdate messages and bids, or self-accept a bid. Found by the 2026-10-10
-- review and reproduced locally.
--
-- 1-2 are catalog-wide, so a future table or column that inherits the default
-- ACL fails here instead of shipping. Legitimate user inserts for messages,
-- disputes, reports and blocks stay covered by their own suites.
begin;
create extension if not exists pgtap;

select plan(26);

-- ── 1-2: catalog-wide invariants ────────────────────────────────────────
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v')
     -- objects owned by an extension (e.g. pgTAP's views) are not ours
     and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
     and has_table_privilege('authenticated', c.oid, 'INSERT')),
  '',
  'no public table or view grants table-level INSERT to authenticated (column lists only)'
);
select is(
  (select coalesce(string_agg(c.relname || '.' || a.attname, ', ' order by 1), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r'
     and a.attname in ('status', 'created_at', 'updated_at', 'accepted_bid_id', 'completed_at',
                       'is_suspended', 'suspended_reason', 'suspension_reason', 'suspended_at',
                       'reply', 'reply_at', 'resolution_note', 'resolved_by', 'resolved_at',
                       'reviewed_by', 'reviewed_at', 'admin_note', 'is_admin', 'plan_tier',
                       'plan_expires_at', 'verification_status', 'terms_accepted_at',
                       'terms_version', 'last_message_at', 'cancellation_reason')
     and has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT')),
  '',
  'authenticated cannot INSERT any server-owned column on any public table'
);

-- ── 3-6: exact column allowlists for the core marketplace tables ────────
create function pg_temp.insert_cols(p_table text) returns text language sql as $$
  select coalesce(string_agg(a.attname, ',' order by a.attname), '')
  from pg_attribute a
  where a.attrelid = ('public.' || p_table)::regclass and a.attnum > 0 and not a.attisdropped
    and has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT')
$$;
select is(pg_temp.insert_cols('shoots'),
  'brief,budget_max_chf,budget_min_chf,canton,client_id,discipline,duration_hours,location_city,location_postcode,shoot_date,title,type',
  'shoots: only the posting form''s columns are insertable');
select is(pg_temp.insert_cols('bids'), 'amount_chf,message,photographer_id,shoot_id',
  'bids: only shoot, photographer, amount and message are insertable');
select is(pg_temp.insert_cols('reviews'), 'client_id,comment,photographer_id,rating,shoot_id',
  'reviews: the client cannot write the photographer''s reply');
select is(pg_temp.insert_cols('disputes') || ' | ' || pg_temp.insert_cols('reports'),
  'opened_by,reason,shoot_id | category,reason,reporter_id,target_id,target_type',
  'disputes and reports: no resolution or review fields are insertable');

-- ── 7-11: tables only server code or SECURITY DEFINER triggers write ─────
select ok(
  not has_any_column_privilege('authenticated', 'public.profiles', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.conversations', 'INSERT')
  and not has_any_column_privilege('authenticated', 'public.notifications', 'INSERT'),
  'profiles, conversations and notifications are not directly insertable'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.disputes', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.reports', 'UPDATE')
  and not has_any_column_privilege('authenticated', 'public.messages', 'UPDATE'),
  'disputes, reports and messages are not directly updatable (admin/service paths only)'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.profile_views', 'SELECT')
  and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_views'),
  'profile_views (who viewed whom) is not directly readable and has no read policy left'
);
select is(
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and has_table_privilege('authenticated', c.oid, 'DELETE')
     and not exists (select 1 from pg_policies p where p.schemaname = 'public'
                     and p.tablename = c.relname and p.cmd in ('DELETE', 'ALL'))),
  '',
  'authenticated holds DELETE only where an owner-only delete policy exists'
);
select is(
  (select coalesce(string_agg(distinct x.privilege_type, ',' order by x.privilege_type), '')
   from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace,
        aclexplode(d.defaclacl) x
   where n.nspname = 'public' and d.defaclobjtype = 'r'
     and d.defaclrole = 'postgres'::regrole
     and x.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and x.privilege_type <> 'SELECT'),
  '',
  'tables created by migrations start with no write privilege for anon/authenticated'
);

-- ── fixtures (as the table owner) ───────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ig-client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"IG Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ig-photog@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"IG Photographer"}', now(), now());

-- An open shoot with a pending bid: the bait for forging.
insert into public.shoots (id, client_id, title, type, discipline, canton, location_city,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief)
values ('00000000-0000-0000-0001-0000000000b1', '00000000-0000-0000-0000-0000000000b1',
        'IG Open Shoot', 'wedding', 'photo', 'ZH', 'Zürich',
        current_date + 30, 4, 1000, 2000, 'Brief for insert grants hardening.');
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values ('00000000-0000-0000-0002-0000000000b1', '00000000-0000-0000-0001-0000000000b1',
        '00000000-0000-0000-0000-0000000000b2', 1500, 'Happy to shoot your wedding.');

-- An open shoot nobody has bid on yet, so forged bids can't trip the
-- one-bid-per-photographer constraint instead of the privilege check.
insert into public.shoots (id, client_id, title, type, discipline, canton, location_city,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief)
values ('00000000-0000-0000-0001-0000000000b3', '00000000-0000-0000-0000-0000000000b1',
        'IG Fresh Shoot', 'event', 'photo', 'ZH', 'Zürich',
        current_date + 40, 3, 600, 1200, 'Brief with no bids yet.');

-- A genuinely completed booking, for the legitimate review path.
insert into public.shoots (id, client_id, title, type, discipline, canton, location_city,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief)
values ('00000000-0000-0000-0001-0000000000b2', '00000000-0000-0000-0000-0000000000b1',
        'IG Done Shoot', 'portrait', 'photo', 'ZH', 'Zürich',
        current_date + 20, 2, 300, 600, 'Brief for the completed booking.');
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values ('00000000-0000-0000-0002-0000000000b2', '00000000-0000-0000-0001-0000000000b2',
        '00000000-0000-0000-0000-0000000000b2', 450, 'Portrait session, two hours.');
-- Driven through the legal state machine: open -> assigned -> completed.
update public.shoots set status = 'assigned', accepted_bid_id = '00000000-0000-0000-0002-0000000000b2'
 where id = '00000000-0000-0000-0001-0000000000b2';
update public.shoots set status = 'completed'
 where id = '00000000-0000-0000-0001-0000000000b2';

-- ── 12-18: the client ───────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

select throws_ok(
  $$insert into public.shoots (client_id, title, type, discipline, canton, location_city,
                               shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief,
                               status, accepted_bid_id, completed_at)
    values ('00000000-0000-0000-0000-0000000000b1', 'Forged', 'wedding', 'photo', 'ZH', 'Zürich',
            current_date - 1, 4, 1000, 2000, 'Forged completed shoot pointing at a pending bid.',
            'completed', '00000000-0000-0000-0002-0000000000b1', now())$$,
  '42501', null,
  'a client cannot insert a shoot that is already completed with a chosen bid'
);
select throws_ok(
  $$insert into public.shoots (client_id, title, type, discipline, canton, location_city,
                               shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief, created_at)
    values ('00000000-0000-0000-0000-0000000000b1', 'Backdated', 'wedding', 'photo', 'ZH', 'Zürich',
            current_date + 9, 4, 1000, 2000, 'A shoot with a backdated created_at.', now() - interval '1 year')$$,
  '42501', null,
  'a client cannot backdate a shoot'
);
select lives_ok(
  $$insert into public.shoots (client_id, title, type, discipline, canton, location_city,
                               location_postcode, shoot_date, duration_hours, budget_min_chf,
                               budget_max_chf, brief)
    values ('00000000-0000-0000-0000-0000000000b1', 'Legit', 'event', 'photo', 'BE', 'Bern', '3011',
            current_date + 15, 3, 500, 900, 'A normal shoot posted through the form.')$$,
  'a client can still post a shoot with the form''s columns'
);
select is(
  (select status::text || '/' || coalesce(accepted_bid_id::text, 'none')
   from public.shoots where title = 'Legit'),
  'open/none',
  'a posted shoot always starts open with no accepted bid'
);
select throws_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating, comment, reply, reply_at)
    values ('00000000-0000-0000-0001-0000000000b2', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000b2', 1, 'Terrible.', 'You are right, sorry.', now())$$,
  '42501', null,
  'a client cannot write the photographer''s reply into their own review'
);
select lives_ok(
  $$insert into public.reviews (shoot_id, client_id, photographer_id, rating, comment)
    values ('00000000-0000-0000-0001-0000000000b2', '00000000-0000-0000-0000-0000000000b1',
            '00000000-0000-0000-0000-0000000000b2', 5, 'Lovely portraits, on time.')$$,
  'a client can still review a completed booking'
);
select throws_ok(
  $$insert into public.disputes (shoot_id, opened_by, reason, status, resolution_note)
    values ('00000000-0000-0000-0001-0000000000b2', '00000000-0000-0000-0000-0000000000b1',
            'The photographer did not deliver the photos.', 'resolved', 'Framly: photographer at fault')$$,
  '42501', null,
  'a client cannot file a dispute that is already resolved'
);

-- ── 19-22: the photographer ─────────────────────────────────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';

select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message, status)
    values ('00000000-0000-0000-0001-0000000000b3', '00000000-0000-0000-0000-0000000000b2',
            1200, 'Self-accepted bid.', 'accepted')$$,
  '42501', null,
  'a photographer cannot insert a bid that is already accepted'
);
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message, created_at)
    values ('00000000-0000-0000-0001-0000000000b3', '00000000-0000-0000-0000-0000000000b2',
            1200, 'Backdated out of this month''s quota.', now() - interval '60 days')$$,
  '42501', null,
  'a photographer cannot backdate a bid (the in-app quota counter would miss it)'
);
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason, status, admin_note)
    values ('00000000-0000-0000-0000-0000000000b2', 'shoot', '00000000-0000-0000-0001-0000000000b1',
            'Spam listing, please check.', 'dismissed', 'closed by admin')$$,
  '42501', null,
  'a reporter cannot file a report that is already closed'
);
select throws_ok(
  $$select count(*) from public.profile_views$$,
  '42501', null,
  'a photographer cannot read raw profile_views rows (viewer identities)'
);
reset role;

-- ── 23-26: the forging attempts left no trace ───────────────────────────
select is(
  (select count(*)::int from public.shoots
   where client_id = '00000000-0000-0000-0000-0000000000b1' and title in ('Forged', 'Backdated')),
  0, 'no forged or backdated shoot exists'
);
select is(
  (select count(*)::int from public.reviews
   where shoot_id = '00000000-0000-0000-0001-0000000000b2' and reply is null and rating = 5),
  1, 'the only review is the legitimate one, with no pre-filled reply'
);
select is(
  (select count(*)::int from public.disputes where shoot_id = '00000000-0000-0000-0001-0000000000b2'),
  0, 'no pre-resolved dispute exists'
);
select is(
  (select count(*)::int from public.bids where shoot_id = '00000000-0000-0000-0001-0000000000b3'),
  0, 'no forged (self-accepted or backdated) bid exists'
);

select * from finish();
rollback;
