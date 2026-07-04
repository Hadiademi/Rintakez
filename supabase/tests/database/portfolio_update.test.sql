-- Task S3.2: portfolio editor pro — reorder (sort_order) + captions.
-- portfolio_images gains a column-scoped UPDATE grant (sort_order, caption) and
-- an owner UPDATE RLS policy. The caption column carries a length check. This
-- test proves: an owner may update sort_order and caption; a non-owner cannot;
-- non-granted columns stay locked; and the caption length check holds.
begin;
create extension if not exists pgtap;

select plan(6);

-- Owner (…b1) and a second photographer / non-owner (…b2). handle_new_user
-- creates the matching public.profiles rows from the metadata role.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pfo1@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Portfolio Owner"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'pfo2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Other Photographer"}', now(), now());

-- Seed one portfolio image owned by …b1 (inserted as superuser, bypassing RLS).
insert into public.portfolio_images (id, photographer_id, storage_path, sort_order)
values ('40000000-0000-0000-0000-0000000000b1',
        '00000000-0000-0000-0000-0000000000b1', 'b1/one.jpg', 0);

-- ── 1: the owner may update sort_order ───────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok(
  $$update public.portfolio_images set sort_order = 3
    where id = '40000000-0000-0000-0000-0000000000b1'$$,
  'the owner may update sort_order'
);

-- ── 2: the owner may update caption ──────────────────────────────────
select lives_ok(
  $$update public.portfolio_images set caption = 'Golden hour in Zermatt'
    where id = '40000000-0000-0000-0000-0000000000b1'$$,
  'the owner may update caption'
);

-- ── 3: the caption is persisted ──────────────────────────────────────
select results_eq(
  $$select caption from public.portfolio_images
    where id = '40000000-0000-0000-0000-0000000000b1'$$,
  $$values ('Golden hour in Zermatt'::text)$$,
  'the caption update is persisted'
);

-- ── 4: a non-granted column stays locked (column-scoped grant) ───────
select throws_ok(
  $$update public.portfolio_images set storage_path = 'b1/hacked.jpg'
    where id = '40000000-0000-0000-0000-0000000000b1'$$,
  '42501',
  null,
  'the owner cannot update a non-granted column (storage_path)'
);

-- ── 5: a non-owner update touches no rows (RLS) ──────────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
update public.portfolio_images set caption = 'stolen'
  where id = '40000000-0000-0000-0000-0000000000b1';
reset role;
select results_eq(
  $$select caption from public.portfolio_images
    where id = '40000000-0000-0000-0000-0000000000b1'$$,
  $$values ('Golden hour in Zermatt'::text)$$,
  'a non-owner cannot change another photographer''s caption'
);

-- ── 6: the caption length check rejects an empty string ──────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok(
  $$update public.portfolio_images set caption = ''
    where id = '40000000-0000-0000-0000-0000000000b1'$$,
  '23514',
  null,
  'an empty caption is rejected by the length check'
);
reset role;

select * from finish();
rollback;
