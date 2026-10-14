set local lock_timeout = '5s';

-- The other side hears about it.
--
-- Until now several state changes reached nobody: a photographer withdrew or
-- changed an offer and the client wasn't told; a client edited or cancelled an
-- open shoot and the photographers waiting on an answer weren't told; a shoot
-- was marked completed and its photographer wasn't told; a dispute was opened
-- or closed and the counterparty heard nothing; a shoot's date passed without
-- a booking and the client's shoot just stayed "open".
--
-- All in-app (bell + live toast), created by SECURITY DEFINER triggers like
-- every other notification, so clients can't forge them. Repeatable events
-- (edits, withdraw/re-send, disputes) are de-duplicated while an earlier one
-- of the same kind is still unread: a string of small edits — or someone
-- toggling an offer through the API — is one notification, not ten.

alter type public.notification_type add value if not exists 'bid_withdrawn';
alter type public.notification_type add value if not exists 'bid_updated';
alter type public.notification_type add value if not exists 'shoot_updated';
alter type public.notification_type add value if not exists 'shoot_completed';
alter type public.notification_type add value if not exists 'dispute_opened';
alter type public.notification_type add value if not exists 'dispute_resolved';
alter type public.notification_type add value if not exists 'shoot_expired';

-- ── Offers → the client ─────────────────────────────────────────────
-- withdrawn: pending → withdrawn. Re-sent: withdrawn → pending is a new offer
-- to the client (submitBidAction revives the row), so it says bid_received.
-- Changed: amount or message of a pending offer.
create or replace function public.notify_bid_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_shoot_status public.shoot_status;
  v_type text;
begin
  select client_id, status into v_client, v_shoot_status
  from shoots where id = new.shoot_id;
  -- Only offers on a shoot that is still open matter to its client.
  if v_client is null or v_client = new.photographer_id
     or v_shoot_status <> 'open' then
    return new;
  end if;

  if old.status = 'pending' and new.status = 'withdrawn' then
    v_type := 'bid_withdrawn';
  elsif old.status = 'withdrawn' and new.status = 'pending' then
    v_type := 'bid_received';
  elsif old.status = 'pending' and new.status = 'pending'
        and (new.amount_chf is distinct from old.amount_chf
             or new.message is distinct from old.message) then
    v_type := 'bid_updated';
  else
    return new;
  end if;

  if not exists (
    select 1 from notifications n
    where n.user_id = v_client and n.type::text = v_type
      and n.bid_id = new.id and n.read_at is null
  ) then
    insert into notifications (user_id, type, shoot_id, bid_id)
    values (v_client, v_type::public.notification_type, new.shoot_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_bid_change_notify on public.bids;
create trigger on_bid_change_notify
  after update on public.bids
  for each row execute function public.notify_bid_change();

-- ── Shoot edited / completed → its photographers ────────────────────
-- An edit of an open shoot reaches everyone whose offer is still pending
-- (date, place, budget… may change what they offered). Completion reaches
-- the booked photographer.
create or replace function public.notify_shoot_progress()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_photographer uuid;
begin
  if old.status = 'open' and new.status = 'open'
     and (new.title, new.brief, new.type, new.discipline, new.location_city,
          new.location_postcode, new.canton, new.shoot_date, new.duration_hours,
          new.budget_min_chf, new.budget_max_chf)
         is distinct from
         (old.title, old.brief, old.type, old.discipline, old.location_city,
          old.location_postcode, old.canton, old.shoot_date, old.duration_hours,
          old.budget_min_chf, old.budget_max_chf) then
    insert into notifications (user_id, type, shoot_id, bid_id)
    select b.photographer_id, 'shoot_updated', new.id, b.id
    from bids b
    where b.shoot_id = new.id
      and b.status = 'pending'
      and not exists (
        select 1 from notifications n
        where n.user_id = b.photographer_id and n.type = 'shoot_updated'
          and n.shoot_id = new.id and n.read_at is null
      );
  elsif old.status = 'assigned' and new.status = 'completed'
        and new.accepted_bid_id is not null then
    select photographer_id into v_photographer
    from bids where id = new.accepted_bid_id;
    if v_photographer is not null then
      insert into notifications (user_id, type, shoot_id, bid_id)
      values (v_photographer, 'shoot_completed', new.id, new.accepted_bid_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_shoot_progress_notify on public.shoots;
create trigger on_shoot_progress_notify
  after update on public.shoots
  for each row execute function public.notify_shoot_progress();

-- ── Shoot cancelled → also the photographers still waiting ──────────
-- Was: only the booked photographer of an assigned shoot. Now an open shoot's
-- pending bidders hear it too, instead of an offer that never gets an answer.
create or replace function public.notify_shoot_cancelled()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_photographer uuid;
begin
  if new.status = 'cancelled' and old.status = 'assigned'
     and old.accepted_bid_id is not null then
    select photographer_id into v_photographer
    from bids where id = old.accepted_bid_id;
    if v_photographer is not null then
      insert into notifications (user_id, type, shoot_id)
      values (v_photographer, 'shoot_cancelled', new.id);
    end if;
  elsif new.status = 'cancelled' and old.status = 'open' then
    insert into notifications (user_id, type, shoot_id, bid_id)
    select b.photographer_id, 'shoot_cancelled', new.id, b.id
    from bids b
    where b.shoot_id = new.id and b.status = 'pending';
  end if;
  return new;
end;
$$;

-- ── Disputes → the counterparty, and both when closed ───────────────
create or replace function public.notify_dispute_parties()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_client uuid;
  v_photographer uuid;
begin
  select s.client_id, b.photographer_id
    into v_client, v_photographer
  from shoots s
  left join bids b on b.id = s.accepted_bid_id
  where s.id = new.shoot_id;

  if tg_op = 'INSERT' then
    insert into notifications (user_id, type, shoot_id)
    select party, 'dispute_opened', new.shoot_id
    from unnest(array[v_client, v_photographer]) as party
    where party is not null and party <> new.opened_by
      and not exists (
        select 1 from notifications n
        where n.user_id = party and n.type = 'dispute_opened'
          and n.shoot_id = new.shoot_id and n.read_at is null
      );
  elsif old.status = 'open' and new.status in ('resolved', 'dismissed') then
    insert into notifications (user_id, type, shoot_id)
    select party, 'dispute_resolved', new.shoot_id
    from unnest(array[v_client, v_photographer]) as party
    where party is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_dispute_notify_parties on public.disputes;
create trigger on_dispute_notify_parties
  after insert or update of status on public.disputes
  for each row execute function public.notify_dispute_parties();

-- ── Who may read a cancelled shoot ──────────────────────────────────
-- The photographers told above that an open shoot was cancelled must be able
-- to open it (and keep it in "my bids", marked cancelled): until now RLS
-- showed a cancelled shoot only to its client and the booked photographer,
-- so the notification led to a 404. Pending bidders only — nothing they
-- hadn't already seen while it was open. SECURITY DEFINER so the policy
-- doesn't recurse through bids' own RLS.
create or replace function public.is_pending_bidder(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from bids
    where shoot_id = p_shoot_id
      and photographer_id = auth.uid()
      and status = 'pending'
  );
$$;
-- Every role that reads shoots evaluates the policy, visitors included (for
-- them auth.uid() is null, so it is simply false) — so anon needs EXECUTE too,
-- like is_accepted_photographer. It only ever answers about the caller.
revoke all on function public.is_pending_bidder(uuid) from public;
grant execute on function public.is_pending_bidder(uuid) to anon, authenticated;

drop policy "shoots_select" on public.shoots;
create policy "shoots_select" on public.shoots
  for select using (
    (status = 'open' and not is_suspended)
    or client_id = auth.uid()
    or public.is_accepted_photographer(id)
    or (status = 'cancelled' and public.is_pending_bidder(id))
  );

-- The de-duplication and expiry lookups above search notifications by shoot.
create index if not exists notifications_shoot_type_idx
  on public.notifications (shoot_id, type);

-- ── Expired open shoots → the client (cron) ─────────────────────────
-- A shoot whose date passed without a booking leaves the browse list and
-- takes no offers, but stayed "open" for its client with no word. The cron
-- (src/lib/lifecycle.ts) calls this once per tick; each shoot is told once.
-- Only dates within the last week, so the first run doesn't notify every
-- client about shoots that lapsed months ago.
create or replace function public.lifecycle_notify_expired_shoots(
  p_today date,
  p_limit integer default 200
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  with due as (
    select s.id, s.client_id
    from shoots s
    where s.status = 'open'
      and s.shoot_date < p_today
      and s.shoot_date >= p_today - 7
      and not exists (
        select 1 from notifications n
        where n.shoot_id = s.id and n.type = 'shoot_expired'
      )
    order by s.shoot_date
    limit p_limit
  )
  insert into notifications (user_id, type, shoot_id)
  select client_id, 'shoot_expired', id from due;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Service role only (Supabase's default ACL grants EXECUTE to anon and
-- authenticated explicitly, so revoking from PUBLIC alone is not enough —
-- see 20261008130000).
revoke all on function public.lifecycle_notify_expired_shoots(date, integer)
  from public, anon, authenticated;
grant execute on function public.lifecycle_notify_expired_shoots(date, integer)
  to service_role;
