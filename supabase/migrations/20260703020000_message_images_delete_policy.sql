-- Follow-up to Task S1.1: allow a conversation participant to DELETE their own
-- message-image objects. sendImageMessage() rolls back an orphaned upload when
-- the subsequent message insert fails; without a delete policy that cleanup was
-- silently denied by storage RLS, leaking orphan objects. Same participation
-- gate as the select/insert policies.
create policy "storage_delete_message_images_participant" on storage.objects
  for delete using (
    bucket_id = 'message-images'
    and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
  );
