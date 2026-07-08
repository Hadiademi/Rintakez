-- Performance batch.

-- 1. "Open shoots, newest first" is the access path for the landing, the browse
--    page and my-shoots, but the only shoots index was (status, canton,
--    shoot_date). Add one that matches the ordering.
create index if not exists shoots_status_created_idx
  on public.shoots (status, created_at desc);

-- 2. Denormalize the last message onto the conversation so the inbox preview no
--    longer reads every message body of every conversation. The touch trigger
--    (already SECURITY DEFINER) now also stores body + sender.
alter table public.conversations
  add column if not exists last_message_body text,
  add column if not exists last_sender_id uuid;

create or replace function public.touch_conversation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update conversations
  set last_message_at = new.created_at,
      last_message_body = new.body,
      last_sender_id = new.sender_id
  where id = new.conversation_id;
  return new;
end;
$$;

-- Backfill existing conversations from their latest message.
update conversations c
set last_message_body = m.body,
    last_sender_id = m.sender_id
from (
  select distinct on (conversation_id) conversation_id, body, sender_id
  from messages
  order by conversation_id, created_at desc
) m
where m.conversation_id = c.id;
