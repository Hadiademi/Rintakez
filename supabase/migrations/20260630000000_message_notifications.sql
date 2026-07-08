-- Notify a conversation participant when they receive a new message, plus a
-- per-user email preference for message notifications.
--
-- In-app notifications are created by a SECURITY DEFINER trigger (users cannot
-- forge them). To avoid one notification row per message, a new
-- message_received notification is inserted only when the recipient has no
-- unread message_received notification for the same shoot yet — repeated
-- messages coalesce into a single unread signal until the recipient reads them.

alter type public.notification_type add value if not exists 'message_received';

alter table public.profiles
  add column if not exists notify_messages boolean not null default true;

-- Keep the profiles UPDATE grant column-scoped (admin/role columns stay out of
-- reach); extend it with just the new preference column.
grant update (notify_messages) on public.profiles to authenticated;

create or replace function public.notify_message_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_photographer uuid;
  v_shoot uuid;
  v_recipient uuid;
begin
  select client_id, photographer_id, shoot_id
    into v_client, v_photographer, v_shoot
    from conversations
    where id = new.conversation_id;

  v_recipient := case
    when new.sender_id = v_client then v_photographer
    else v_client
  end;

  if v_recipient is null or v_recipient = new.sender_id then
    return new;
  end if;

  -- Coalesce: one unread "new message" notification per shoot until it is read.
  if exists (
    select 1 from notifications
    where user_id = v_recipient
      and type = 'message_received'
      and shoot_id = v_shoot
      and read_at is null
  ) then
    return new;
  end if;

  insert into notifications (user_id, type, shoot_id)
  values (v_recipient, 'message_received', v_shoot);
  return new;
end;
$$;

create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.notify_message_received();
