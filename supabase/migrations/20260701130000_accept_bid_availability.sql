-- Enforce photographer availability at acceptance time (#launch-hardening D4).
-- photographer_unavailable (supabase/migrations/20260613120000_favorites_availability.sql)
-- has existed since the availability feature shipped but gated nothing in
-- accept_bid — a client could still book a photographer on a date the
-- photographer explicitly blocked, and nothing prevented a photographer from
-- being awarded two shoots on the same date. This migration reproduces the
-- latest accept_bid (20260624010000_accept_bid_hardening.sql) verbatim and
-- adds two guards, after the existing suspended/discipline checks and before
-- any mutation:
--   * the winning photographer must not have a photographer_unavailable row
--     for the shoot's date, and
--   * the winning photographer must not already be the accepted photographer
--     (shoots.status = 'assigned') of another shoot on the same date.
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
  v_shoot_date date;
begin
  if public.is_suspended() then
    raise exception 'account suspended' using errcode = 'P0001';
  end if;

  select b.shoot_id, s.client_id, b.photographer_id, s.discipline, s.shoot_date
    into v_shoot_id, v_client_id, v_photographer_id, v_discipline, v_shoot_date
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

  -- The winning photographer must not have explicitly blocked this date.
  if exists (
    select 1 from public.photographer_unavailable pu
    where pu.photographer_id = v_photographer_id
      and pu.date = v_shoot_date
  ) then
    raise exception 'photographer unavailable' using errcode = 'P0001';
  end if;

  -- The winning photographer must not already be booked (assigned) on another
  -- shoot for the same date.
  if exists (
    select 1
    from shoots s2
    join bids b2 on b2.id = s2.accepted_bid_id
    where b2.photographer_id = v_photographer_id
      and s2.shoot_date = v_shoot_date
      and s2.status = 'assigned'
      and s2.id <> v_shoot_id
  ) then
    raise exception 'photographer already booked' using errcode = 'P0001';
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
