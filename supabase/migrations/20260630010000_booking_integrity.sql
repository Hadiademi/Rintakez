-- Batch 2 — booking integrity & re-bidding.

-- 1. Premature-completion guard. complete_shoot only checked ownership + status,
--    so a client could mark a shoot 'completed' (which unlocks the public review
--    and strands the photographer) the instant a bid was accepted — days or
--    weeks before the session. Require the shoot date to have arrived, mirroring
--    the date guard already on bids_insert_photographer.
create or replace function public.complete_shoot(p_shoot_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update shoots set status = 'completed'
  where id = p_shoot_id
    and client_id = auth.uid()
    and status = 'assigned'
    and shoot_date <= current_date;
  if not found then
    raise exception 'cannot complete shoot' using errcode = 'P0001';
  end if;
end;
$$;

-- 2. Reopen an orphaned booking. When an assigned photographer's accepted bid is
--    deleted (typically: they delete their account, which cascades their bids),
--    shoots.accepted_bid_id is SET NULL but the shoot stayed 'assigned' forever —
--    get_counterparty_email returned nothing and the client could neither review
--    nor receive new bids. A BEFORE DELETE trigger reopens the shoot so the
--    client can be matched again.
--
--    The status guard forbids assigned->open; a transaction-local GUC authorizes
--    this one path (so a client cannot reach it by a direct UPDATE).
alter type public.notification_type add value if not exists 'shoot_reopened';

create or replace function public.shoots_status_guard()
returns trigger
language plpgsql
as $$
begin
  -- accepted_bid_id may only be SET (to a non-null bid) during open->assigned.
  -- Clearing it to NULL is permitted (ON DELETE SET NULL cleanup).
  if NEW.accepted_bid_id is distinct from OLD.accepted_bid_id then
    if NEW.accepted_bid_id is not null
       and NOT (OLD.status = 'open' and NEW.status = 'assigned') then
      raise exception 'accepted_bid_id is managed by accept_bid'
        using errcode = 'P0001';
    end if;
  end if;

  if OLD.status = NEW.status then
    return NEW;
  end if;

  if (OLD.status = 'open'      and NEW.status = 'cancelled')  or
     (OLD.status = 'open'      and NEW.status = 'assigned')   or
     (OLD.status = 'assigned'  and NEW.status = 'cancelled')  or
     (OLD.status = 'assigned'  and NEW.status = 'completed')  or
     (OLD.status = 'assigned'  and NEW.status = 'open'
        and NEW.accepted_bid_id is null
        and coalesce(current_setting('rintakez.reopen_orphan', true), '') = '1') then
    return NEW;
  end if;

  raise exception 'illegal shoot status transition'
    using errcode = 'P0001';
end;
$$;

create or replace function public.reopen_orphaned_shoot()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_shoot uuid;
  v_client uuid;
begin
  -- Only the winning (accepted) bid can orphan a booking.
  if old.status <> 'accepted' then
    return old;
  end if;

  -- If the parent shoot is itself being deleted, it is no longer visible here
  -- (MVCC) and this finds nothing — so we never touch a shoot that is going away.
  select id, client_id into v_shoot, v_client
  from shoots
  where accepted_bid_id = old.id and status = 'assigned'
  for update;

  if v_shoot is not null then
    perform set_config('rintakez.reopen_orphan', '1', true);
    update shoots set status = 'open', accepted_bid_id = null where id = v_shoot;
    perform set_config('rintakez.reopen_orphan', '0', true);

    insert into notifications (user_id, type, shoot_id)
    values (v_client, 'shoot_reopened', v_shoot);
  end if;

  return old;
end;
$$;

create trigger on_accepted_bid_delete
  before delete on public.bids
  for each row execute function public.reopen_orphaned_shoot();

-- 3. Allow re-bidding after a withdrawal. The old policy's USING clause required
--    status='pending', so a 'withdrawn' bid could never be updated, and the
--    unique(shoot_id, photographer_id) constraint blocked a fresh insert — a
--    permanent lockout. Permit a withdrawn row to be revived (and an existing
--    row to be edited) only while the shoot is still open. Withdrawing is always
--    allowed so it never errors on an already-closed shoot.
drop policy "bids_update_own_pending" on public.bids;
create policy "bids_update_own_pending" on public.bids
  for update
  using (photographer_id = auth.uid() and status in ('pending', 'withdrawn'))
  with check (
    photographer_id = auth.uid()
    and (
      status = 'withdrawn'
      or (
        status = 'pending'
        and exists (
          select 1 from public.shoots s
          where s.id = shoot_id and s.status = 'open'
        )
      )
    )
  );
