-- Tier A (A3) — user block/mute. Lets a user stop another user from messaging
-- them (harassment control). Report rate-limiting already exists in the report
-- action; image content-moderation is deferred until a provider is chosen.

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

grant select, insert, delete on public.user_blocks to authenticated;

-- A user manages only their own block list.
create policy "user_blocks_select_own" on public.user_blocks
  for select using (blocker_id = auth.uid());
create policy "user_blocks_insert_own" on public.user_blocks
  for insert with check (blocker_id = auth.uid());
create policy "user_blocks_delete_own" on public.user_blocks
  for delete using (blocker_id = auth.uid());

-- Whether p_other has blocked the current user. SECURITY DEFINER because a user
-- cannot read another user's block rows under RLS, yet the UI needs to know it
-- was blocked (to hide the composer).
create or replace function public.blocked_by(p_other uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where blocker_id = p_other and blocked_id = auth.uid()
  );
$$;

revoke execute on function public.blocked_by(uuid) from public;
grant execute on function public.blocked_by(uuid) to authenticated;

-- True if the OTHER participant of the conversation has blocked the current
-- user. SECURITY DEFINER so it can read the blocker's user_blocks row, which RLS
-- would otherwise hide from a policy subquery evaluated as the blocked user.
create or replace function public.is_blocked_in_conversation(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    join public.user_blocks ub
      on ub.blocked_id = auth.uid()
     and ub.blocker_id = case
           when c.client_id = auth.uid() then c.photographer_id
           else c.client_id
         end
    where c.id = p_conversation_id
  );
$$;

-- Recreate the message insert policy so a sender cannot message a conversation
-- whose OTHER participant has blocked them (keeps the suspension guard too).
drop policy "messages_insert_participant" on public.messages;
create policy "messages_insert_participant" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and not public.is_suspended()
    and not public.is_blocked_in_conversation(conversation_id)
  );
