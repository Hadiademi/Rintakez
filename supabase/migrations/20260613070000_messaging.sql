-- In-app messaging. A conversation opens automatically when a shoot is assigned
-- (the client and the accepted photographer can talk). Only the two
-- participants can read/write. Messages stream over realtime.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null unique references public.shoots (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  client_last_read_at timestamptz,
  photographer_last_read_at timestamptz
);

create index conversations_client_idx
  on public.conversations (client_id, last_message_at desc);
create index conversations_photographer_idx
  on public.conversations (photographer_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

grant select on public.conversations to authenticated;
-- Participants may only touch their own read markers, nothing structural.
grant update (client_last_read_at, photographer_last_read_at)
  on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from conversations c
    where c.id = p_conversation_id
      and (c.client_id = auth.uid() or c.photographer_id = auth.uid())
  );
$$;

create policy "conversations_select_participant" on public.conversations
  for select using (client_id = auth.uid() or photographer_id = auth.uid());

-- Participants may only update their own last-read marker (not reassign anyone).
create policy "conversations_update_participant" on public.conversations
  for update using (client_id = auth.uid() or photographer_id = auth.uid())
  with check (client_id = auth.uid() or photographer_id = auth.uid());

create policy "messages_select_participant" on public.messages
  for select using (public.is_conversation_participant(conversation_id));

create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

-- ── triggers ─────────────────────────────────────────────────────────
-- Open a conversation when a shoot is assigned.
create or replace function public.create_conversation_on_assign()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_photographer uuid;
begin
  if new.status = 'assigned' and old.status = 'open'
     and new.accepted_bid_id is not null then
    select photographer_id into v_photographer
    from bids where id = new.accepted_bid_id;
    if v_photographer is not null then
      insert into conversations (shoot_id, client_id, photographer_id)
      values (new.id, new.client_id, v_photographer)
      on conflict (shoot_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger conversation_on_assign
  after update on public.shoots
  for each row execute function public.create_conversation_on_assign();

-- Bump last_message_at when a message is sent.
create or replace function public.touch_conversation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger message_touches_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- ── realtime ─────────────────────────────────────────────────────────
alter table public.messages replica identity full;
alter publication supabase_realtime add table public.messages;
