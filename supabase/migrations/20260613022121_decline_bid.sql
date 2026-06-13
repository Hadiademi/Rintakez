-- Client-side decline of a single pending bid on their own open shoot.
-- SECURITY DEFINER because RLS does not let clients UPDATE bids directly.
create or replace function public.decline_bid(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  select s.client_id into v_client_id
  from bids b
  join shoots s on s.id = b.shoot_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and s.status = 'open'
  for update of b, s;

  if v_client_id is null then
    raise exception 'bid not declinable';
  end if;

  if v_client_id is distinct from auth.uid() then
    raise exception 'not your shoot';
  end if;

  update bids set status = 'declined' where id = p_bid_id;
end;
$$;

revoke execute on function public.decline_bid(uuid) from public;
grant execute on function public.decline_bid(uuid) to authenticated;
