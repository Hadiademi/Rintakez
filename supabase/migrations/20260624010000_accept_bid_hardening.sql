-- Harden accept_bid (#18 + #24). The previous version (20260622010000) checked
-- only the accepting client's suspension. Acceptance is the moment a shoot is
-- bound to a photographer, so it must also:
--   * refuse a suspended shoot (it is hidden from browse but visible to the
--     owner, who could otherwise still accept on it),
--   * refuse a suspended photographer (suspension blocked new content but not
--     acceptance of a pre-existing bid),
--   * enforce discipline match — a shoot's discipline must be one the winning
--     photographer offers (defensive: only when they list disciplines), and
--   * write an audit_log row so acceptances are on the trail.
create or replace function public.accept_bid(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shoot_id uuid;
  v_client_id uuid;
  v_photographer_id uuid;
  v_discipline public.discipline;
begin
  if public.is_suspended() then
    raise exception 'account suspended' using errcode = 'P0001';
  end if;

  select b.shoot_id, s.client_id, b.photographer_id, s.discipline
    into v_shoot_id, v_client_id, v_photographer_id, v_discipline
  from bids b
  join shoots s on s.id = b.shoot_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and s.status = 'open'
    and s.accepted_bid_id is null
    and not s.is_suspended
  for update of b, s;

  if v_shoot_id is null then
    raise exception 'bid not acceptable';
  end if;

  if v_client_id is distinct from auth.uid() then
    raise exception 'not your shoot';
  end if;

  -- The winning photographer must not be suspended.
  if coalesce((select is_suspended from public.profiles where id = v_photographer_id), false) then
    raise exception 'photographer suspended' using errcode = 'P0001';
  end if;

  -- Discipline match: if the photographer lists disciplines, the shoot's
  -- discipline must be one of them. (A photographer without a details row is not
  -- blocked here — onboarding may be incomplete.)
  if exists (
    select 1 from public.photographer_details pd
    where pd.profile_id = v_photographer_id
      and not (v_discipline = any(pd.disciplines))
  ) then
    raise exception 'discipline mismatch' using errcode = 'P0001';
  end if;

  update bids set status = 'accepted' where id = p_bid_id;

  update bids set status = 'declined'
  where shoot_id = v_shoot_id and id <> p_bid_id and status = 'pending';

  update shoots set status = 'assigned', accepted_bid_id = p_bid_id
  where id = v_shoot_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, meta)
  values (
    auth.uid(), 'bid_accepted', 'shoot', v_shoot_id,
    jsonb_build_object('bid_id', p_bid_id, 'photographer_id', v_photographer_id)
  );
end;
$$;
