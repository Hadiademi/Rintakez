-- 20261008120000_grants_hardening.sql: table-level privileges must not
-- override the column-scoped intent, and anon must never hold direct write
-- privileges. The catalog-wide assertions (1-2) cover EVERY public table, so a
-- future table that inherits Supabase's default ACL without a matching revoke
-- fails here instead of shipping.
begin;
create extension if not exists pgtap;

select plan(11);

-- ── 1-2: catalog-wide hygiene ───────────────────────────────────────────
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'INSERT')
       or has_table_privilege('anon', c.oid, 'UPDATE')
       or has_table_privilege('anon', c.oid, 'DELETE'))),
  0,
  'anon holds no direct INSERT/UPDATE/DELETE on any public table'
);
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'TRUNCATE')
       or has_table_privilege('authenticated', c.oid, 'TRUNCATE'))),
  0,
  'no app role can TRUNCATE any public table (TRUNCATE bypasses RLS)'
);

-- Server-only functions by naming convention: cron candidate readers
-- (lifecycle_*) and admin aggregates (admin_*) must be service-role only.
-- Supabase's default ACL grants EXECUTE on new functions to anon and
-- authenticated EXPLICITLY, so `revoke ... from public` alone does not close
-- them — this assertion covers every current and future function so named.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'lifecycle\_%' or p.proname like 'admin\_%')
     and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'anon cannot execute any lifecycle_* / admin_* server-only function'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'lifecycle\_%' or p.proname like 'admin\_%')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0,
  'authenticated cannot execute any lifecycle_* / admin_* server-only function'
);

-- ── 3-6: column scope is real, not overridden by a table-level grant ─────
select ok(
  not has_table_privilege('authenticated', 'public.reviews', 'UPDATE')
  and has_column_privilege('authenticated', 'public.reviews', 'reply', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.reviews', 'rating', 'UPDATE'),
  'reviews: authenticated may update reply, never rating'
);
select ok(
  not has_table_privilege('authenticated', 'public.conversations', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.conversations', 'client_id', 'UPDATE'),
  'conversations: participants cannot rewrite who is in the thread'
);
select ok(
  has_column_privilege('authenticated', 'public.portfolio_images', 'caption', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.portfolio_images', 'storage_path', 'UPDATE'),
  'portfolio_images: caption is editable, storage_path is not'
);
select ok(
  has_column_privilege('authenticated', 'public.notifications', 'read_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.notifications', 'user_id', 'UPDATE'),
  'notifications: read_at is editable, ownership is not'
);

-- ── 7-9: behavioural proof of the headline fix ──────────────────────────
-- A photographer PATCHing the rating of a review about themselves must be
-- refused with a privilege error (previously it silently succeeded).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'gh-client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"GH Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'gh-photog@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"GH Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, discipline, canton, location_city,
                           shoot_date, duration_hours, budget_min_chf, budget_max_chf, brief, status, completed_at)
values ('00000000-0000-0000-0001-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
        'GH Completed Shoot', 'wedding', 'photo', 'ZH', 'Zürich',
        current_date - 10, 4, 1000, 2000, 'Brief for grants hardening.', 'completed', now() - interval '6 days');

insert into public.reviews (id, shoot_id, client_id, photographer_id, rating, comment)
values ('00000000-0000-0000-0003-0000000000a1', '00000000-0000-0000-0001-0000000000a1',
        '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
        2, 'Two stars, honestly earned.');

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select throws_ok(
  $$update public.reviews set rating = 5 where id = '00000000-0000-0000-0003-0000000000a1'$$,
  '42501', null,
  'the reviewed photographer cannot rewrite the rating'
);
select lives_ok(
  $$update public.reviews set reply = 'Thank you for the feedback.', reply_at = now()
    where id = '00000000-0000-0000-0003-0000000000a1'$$,
  'the reviewed photographer can still post their reply'
);
reset role;

select is(
  (select rating from public.reviews where id = '00000000-0000-0000-0003-0000000000a1'),
  2,
  'the rating is unchanged after the attempted rewrite'
);

select * from finish();
rollback;
