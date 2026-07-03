-- Follow-up to Task S1.1: allow the UPLOADER to DELETE their own message-image
-- object. sendImageMessage() rolls back an orphaned upload when the subsequent
-- message insert fails; without a delete policy that cleanup was silently denied
-- by storage RLS, leaking orphan objects.
--
-- Gated on `owner = auth.uid()` (the uploader), NOT merely on conversation
-- participation: the object path is <conversationId>/<uuid>, so a participation
-- check would let either party delete the counterparty's shared photos via the
-- storage API. Ownership is the precise gate — the rollback only ever removes
-- the object it just uploaded, and no other delete path exists.
create policy "storage_delete_message_images_own" on storage.objects
  for delete using (
    bucket_id = 'message-images'
    and owner = auth.uid()
  );
