-- Close a TOCTOU double-booking race in accept_bid (#launch-hardening D4 review).
-- 20260701130000_accept_bid_availability.sql added an "already booked on this
-- date" guard, but the guard is a plain `select exists` and the `for update
-- of b, s` only locks the *current* bid and shoot row. Two concurrent
-- accept_bid calls for two DIFFERENT shoots on the SAME date, awarding the
-- SAME winning photographer, both run their "already booked" check before
-- either commits: under READ COMMITTED neither sees the other's not-yet-
-- committed `shoots.status = 'assigned'` update, so both checks pass and both
-- transactions commit — the exact double-booking this feature exists to
-- prevent.
--
-- Fix: take an advisory transaction lock keyed on (photographer, shoot_date)
-- as soon as both are known, before the availability guards run. This is a
-- session-level advisory lock scoped to the transaction (released
-- automatically on commit/rollback) that serializes concurrent accept_bid
-- calls for the same photographer on the same date: the second caller blocks
-- until the first commits (or rolls back), then re-runs the "already booked"
-- check against the now-committed data and correctly refuses if the first
-- accept succeeded. hashtext() collapses the composite key to an int4 for
-- pg_advisory_xact_lock's single-key overload; a hash collision only causes
-- extra (harmless) serialization between unrelated photographer/date pairs,
-- never a missed lock.
--
-- This reproduces the body of 20260701130000_accept_bid_availability.sql
-- verbatim, adding only the advisory lock immediately before the
-- unavailable-date and already-booked guards.
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

  -- Serialize concurrent accept_bid calls for this (photographer, date) pair
  -- so the availability guards below can't both pass on stale, not-yet-
  -- committed data. Closes a TOCTOU double-booking race: see migration
  -- header comment for details. The lock is released automatically at
  -- transaction end (commit or rollback).
  perform pg_advisory_xact_lock(hashtext(v_photographer_id::text || '|' || v_shoot_date::text));

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
