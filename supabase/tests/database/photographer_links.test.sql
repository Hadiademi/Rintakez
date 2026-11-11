-- Sport shoot type (20261111120000) and labelled photographer links
-- (20261111130000). The links CHECK is the backstop for direct API writes:
-- the value is rendered as an href on a public profile, so anything that is
-- not a plain http(s) address must be refused by the database itself.
begin;
create extension if not exists pgtap;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-00000000a1a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'links-owner@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Links Owner"}', now(), now()),
  ('00000000-0000-0000-0000-00000000a2a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'links-other@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Links Other"}', now(), now());

insert into public.photographer_details (profile_id) values
  ('00000000-0000-0000-0000-00000000a1a1'),
  ('00000000-0000-0000-0000-00000000a2a2');

-- ── sport ────────────────────────────────────────────────────────────
-- 1
select ok(
  'sport' = any (enum_range(null::public.shoot_type)::text[]),
  'sport is a shoot type'
);
-- 2
select is(
  (select array_position(enum_range(null::public.shoot_type)::text[], 'sport')
        - array_position(enum_range(null::public.shoot_type)::text[], 'event')),
  1,
  'sport sits right after event, matching SHOOT_TYPES in the app'
);

-- ── links: default + privileges ──────────────────────────────────────
-- 3
select is(
  (select links from public.photographer_details where profile_id = '00000000-0000-0000-0000-00000000a1a1'),
  '[]'::jsonb,
  'links default to an empty list'
);
-- 4
select ok(
  has_column_privilege('anon', 'public.photographer_details', 'links', 'SELECT'),
  'anyone can read links (they are on the public profile)'
);
-- 5
select ok(
  has_column_privilege('authenticated', 'public.photographer_details', 'links', 'INSERT')
  and has_column_privilege('authenticated', 'public.photographer_details', 'links', 'UPDATE'),
  'a signed-in owner can write links'
);
-- 6
select ok(
  not has_column_privilege('anon', 'public.photographer_details', 'links', 'UPDATE'),
  'anonymous callers cannot write links'
);

-- ── links: the owner writes valid links, RLS keeps it to their row ───
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000a1a1","role":"authenticated"}';

-- 7: the shape the app writes — sport + wedding presences, labelled.
select lives_ok(
  $$update public.photographer_details
      set links = '[{"url":"https://www.myrensport.com","label":"Sport"},
                    {"url":"https://www.instagram.com/myren.sports","label":"Sport"},
                    {"url":"https://myren-weddings.ch","label":"Hochzeit"},
                    {"url":"http://old-site.ch","label":null},
                    {"url":"https://vimeo.com/anna"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  'the owner can save up to six labelled http(s) links'
);
-- 8
select is(
  (select jsonb_array_length(links) from public.photographer_details
     where profile_id = '00000000-0000-0000-0000-00000000a1a1'),
  5,
  'the links were stored'
);
-- 9: RLS — another photographer's row is untouched by the owner's update.
update public.photographer_details set links = '[{"url":"https://hijack.ch"}]'
  where profile_id = '00000000-0000-0000-0000-00000000a2a2';
reset role;
select is(
  (select links from public.photographer_details where profile_id = '00000000-0000-0000-0000-00000000a2a2'),
  '[]'::jsonb,
  'a photographer cannot write another photographer''s links'
);

-- ── links: the CHECK refuses everything unsafe or malformed ──────────
-- 10
select throws_ok(
  $$update public.photographer_details set links = '[{"url":"javascript:alert(1)"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'a javascript: link is refused'
);
-- 11
select throws_ok(
  $$update public.photographer_details set links = '[{"url":"https://localhost/admin"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'a host without a dot is refused'
);
-- 12
select throws_ok(
  $$update public.photographer_details set links = '[{"url":"https://a.ch/x y"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'a link containing whitespace is refused'
);
-- 13: the NULL trap — a missing url must not slip through as "unknown".
select throws_ok(
  $$update public.photographer_details set links = '[{"label":"Sport"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'an entry without a url is refused'
);
-- 14
select throws_ok(
  $$update public.photographer_details
      set links = '[{"url":"https://a.ch","label":"x","onclick":"alert(1)"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'unknown keys are refused'
);
-- 15
select throws_ok(
  $$update public.photographer_details
      set links = '[{"url":"https://a.ch"},{"url":"https://b.ch"},{"url":"https://c.ch"},
                    {"url":"https://d.ch"},{"url":"https://e.ch"},{"url":"https://f.ch"},
                    {"url":"https://g.ch"}]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'more than six links are refused'
);
-- 16: a non-object element is refused cleanly (CHECK violation, not a crash
-- inside jsonb_object_keys).
select throws_ok(
  $$update public.photographer_details set links = '["https://a.ch"]'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'a bare string instead of an object is refused'
);
-- 17
select throws_ok(
  $$update public.photographer_details set links = '{"url":"https://a.ch"}'
      where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
  '23514', null, 'an object instead of a list is refused'
);
-- 18
select throws_ok(
  format(
    $$update public.photographer_details set links = '[{"url":"https://a.ch","label":"%s"}]'
        where profile_id = '00000000-0000-0000-0000-00000000a1a1'$$,
    repeat('x', 41)
  ),
  '23514', null, 'a label longer than 40 characters is refused'
);

select * from finish();
rollback;
