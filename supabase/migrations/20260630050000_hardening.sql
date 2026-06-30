-- Hardening batch.

-- 1. Read-marker forgery. The column-scoped UPDATE grant let EITHER participant
--    set BOTH *_last_read_at columns, so one side could forge the other side's
--    "last read" (unread-badge tampering). Move read-marking into a SECURITY
--    DEFINER function that only ever updates the caller's own side, and revoke
--    the direct column grant.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_photographer uuid;
begin
  select client_id, photographer_id into v_client, v_photographer
  from conversations where id = p_conversation_id;

  if v_client is null then
    return; -- unknown conversation: no-op
  end if;

  if auth.uid() = v_client then
    update conversations set client_last_read_at = now()
    where id = p_conversation_id;
  elsif auth.uid() = v_photographer then
    update conversations set photographer_last_read_at = now()
    where id = p_conversation_id;
  else
    raise exception 'not a participant' using errcode = 'P0001';
  end if;
end;
$$;

revoke update (client_last_read_at, photographer_last_read_at)
  on public.conversations from authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- 2. Don't allow blocking out PAST dates in the availability calendar (table
--    bloat + nonsensical UI). A table CHECK can't reference current_date
--    (not immutable), so enforce it in the insert policy.
drop policy "pu_insert_own" on public.photographer_unavailable;
create policy "pu_insert_own" on public.photographer_unavailable
  for insert with check (
    photographer_id = auth.uid()
    and public.has_role('photographer')
    and date >= current_date
  );
