-- Task S1.1: photo attachments in chat.
-- A message can now carry an image stored in the private `message-images`
-- bucket. The body becomes optional when an image is present (image-only or
-- image + caption). Storage read/write is gated on conversation participation,
-- mirroring the private shoot-refs bucket.

-- ── schema ───────────────────────────────────────────────────────────
alter table public.messages
  add column image_path text;

-- Relax the body-length CHECK to allow an empty body (image-only messages).
alter table public.messages
  drop constraint messages_body_check;

alter table public.messages
  add constraint messages_body_check
    check (char_length(body) between 0 and 4000);

-- A message must still carry meaning: a non-empty body OR an image.
alter table public.messages
  add constraint messages_body_or_image_check
    check (char_length(body) > 0 or image_path is not null);

-- ── storage bucket (private) ─────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('message-images', 'message-images', false);

-- Objects live under <conversationId>/<uuid>.<ext>; the first path segment pins
-- the conversation, so read/write are gated on conversation participation via
-- the existing SECURITY DEFINER helper. AND short-circuits, so the uuid cast is
-- only evaluated for message-images rows (whose first folder is always a uuid).
create policy "storage_select_message_images_participant" on storage.objects
  for select using (
    bucket_id = 'message-images'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
  );

create policy "storage_insert_message_images_participant" on storage.objects
  for insert with check (
    bucket_id = 'message-images'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
  );

-- Realtime already publishes public.messages with `replica identity full`, so
-- the new image_path column is delivered on INSERT payloads automatically.
