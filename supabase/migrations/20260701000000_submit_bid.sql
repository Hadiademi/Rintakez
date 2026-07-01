-- submit_bid: place or revive a photographer's bid in one round-trip so any
-- Supabase client (web today, native app later) shares the same logic. Runs
-- SECURITY INVOKER, so the existing bids RLS insert policy (photographer role,
-- not a past-date shoot) and the unique (shoot_id, photographer_id) constraint
-- still apply. Mirrors the insert-or-revive-withdrawn behaviour previously
-- inline in submitBidAction.
create or replace function public.submit_bid(
  p_shoot_id uuid,
  p_amount_chf integer,
  p_message text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated integer;
begin
  begin
    insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values (p_shoot_id, auth.uid(), p_amount_chf, p_message);
    return;
  exception when unique_violation then
    -- A bid row already exists for (shoot, photographer). Revive it only if it
    -- was withdrawn; a live bid means the photographer has already bid.
    update public.bids
      set amount_chf = p_amount_chf, message = p_message, status = 'pending'
    where shoot_id = p_shoot_id
      and photographer_id = auth.uid()
      and status = 'withdrawn';
    get diagnostics v_updated = row_count;
    if v_updated = 0 then
      raise exception 'already_bid' using errcode = 'P0001';
    end if;
  end;
end;
$$;

revoke execute on function public.submit_bid(uuid, integer, text) from public;
revoke execute on function public.submit_bid(uuid, integer, text) from anon;
grant execute on function public.submit_bid(uuid, integer, text) to authenticated;
