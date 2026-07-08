-- Task S1.1: photo attachments in chat.
-- A message may now carry an image (image_path) stored in the private
-- `message-images` bucket. Body becomes optional when an image is present, but
-- a message must still carry at least a non-empty body OR an image. Storage
-- reads/writes are gated on conversation participation.
begin;
create extension if not exists pgtap;

select plan(8);

-- Participants: client (…a1) and photographer (…a2). Outsider (…a9).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'imgc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Image Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'imgf@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Image Photographer"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'imgo@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Image Outsider"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
   'Image test shoot', 'portrait', 'Brief for the image test.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900);

insert into public.conversations (id, shoot_id, client_id, photographer_id)
values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

-- ── 1: a participant may insert an image-only message (empty body) ───
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, body, image_path)
    values ('30000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', '',
            '30000000-0000-0000-0000-0000000000a1/photo.jpg')$$,
  'a participant may send an image-only message with an empty body'
);

-- ── 2: a participant may still send a body-only message (unchanged) ──
select lives_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('30000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', 'plain text message')$$,
  'a participant may still send a plain body-only message'
);

-- ── 3: an empty body with no image is rejected (check constraint) ────
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body)
    values ('30000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a2', '')$$,
  '23514',
  null,
  'an empty body with no image is rejected'
);

-- ── 4: a non-participant cannot send an image message ────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
select throws_ok(
  $$insert into public.messages (conversation_id, sender_id, body, image_path)
    values ('30000000-0000-0000-0000-0000000000a1',
            '00000000-0000-0000-0000-0000000000a9', '',
            '30000000-0000-0000-0000-0000000000a1/evil.jpg')$$,
  '42501',
  null,
  'a non-participant cannot send an image message'
);
reset role;

-- ── 5: a participant may write a storage object under the conv folder ─
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('message-images', '30000000-0000-0000-0000-0000000000a1/a.jpg')$$,
  'a participant may upload an object under the conversation folder'
);

-- ── 6: an outsider cannot write a storage object under the conv folder ─
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('message-images', '30000000-0000-0000-0000-0000000000a1/b.jpg')$$,
  '42501',
  null,
  'an outsider cannot upload an object under the conversation folder'
);

-- ── 7: an outsider cannot read the participant's storage object ──────
select results_eq(
  $$select count(*)::int from storage.objects
    where name = '30000000-0000-0000-0000-0000000000a1/a.jpg'$$,
  array[0],
  'an outsider cannot read a conversation image object'
);

-- ── 8: a participant can read the conversation's storage object ──────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$select count(*)::int from storage.objects
    where name = '30000000-0000-0000-0000-0000000000a1/a.jpg'$$,
  array[1],
  'a participant can read the conversation image object'
);
reset role;

select * from finish();
rollback;
