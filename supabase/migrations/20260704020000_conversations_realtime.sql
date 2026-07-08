-- Batch S3.6 Item 3 — publish conversations to Realtime for live read receipts.
--
-- The message thread already subscribes to message INSERTs; to flip a sent ✓
-- to a read ✓✓ the moment the counterparty reads (mark_conversation_read stamps
-- their *_last_read_at column) the thread also needs the conversations row's
-- UPDATEs. Publish the table and set REPLICA IDENTITY FULL so the payload
-- carries client_id / photographer_id / both read-marker columns (needed to
-- tell which side is the counterparty and to let Realtime evaluate RLS —
-- delivery stays gated to the two participants who can already SELECT the row,
-- so no new data is exposed).
alter table public.conversations replica identity full;
alter publication supabase_realtime add table public.conversations;
