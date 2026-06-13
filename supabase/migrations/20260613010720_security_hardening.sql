-- security_hardening.sql
-- Fixes integrity holes found in the security audit.
-- Applied AFTER 20260613005039_schema.sql and 20260613005248_security.sql.
-- Do NOT edit the prior two migrations; this file supersedes them where needed.

-- ── FIX 3: revoke PUBLIC execute; grant to authenticated only ────────
-- The prior migration's "revoke ... from anon" left the default PUBLIC grant
-- intact, so any role could still call these functions.
revoke execute on function public.accept_bid(uuid) from public;
revoke execute on function public.get_counterparty_email(uuid) from public;
grant execute on function public.accept_bid(uuid) to authenticated;
grant execute on function public.get_counterparty_email(uuid) to authenticated;

-- ── FIX 5: pin search_path on enforce_portfolio_limit ───────────────
create or replace function public.enforce_portfolio_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.portfolio_images
      where photographer_id = new.photographer_id) >= 20 then
    raise exception 'portfolio limit reached (20 images)';
  end if;
  return new;
end;
$$;

-- ── FIX 4: handle_new_user robustness — invalid role defaults to 'client' ──
-- An unrecognised role in signup metadata previously crashed on the enum cast.
-- Now we validate explicitly: accept only 'client' or 'photographer', else 'client'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_raw_role text;
begin
  v_raw_role := new.raw_user_meta_data ->> 'role';
  if v_raw_role in ('client', 'photographer') then
    v_role := v_raw_role::public.user_role;
  else
    v_role := 'client';
  end if;

  insert into public.profiles (id, role, display_name, locale)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'locale')::public.locale, 'de')
  );
  return new;
end;
$$;

-- ── FIX 1a: harden accept_bid — add accepted_bid_id IS NULL guard ───
-- Prevents a second accept_bid call from re-accepting an already-assigned shoot.
create or replace function public.accept_bid(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shoot_id uuid;
  v_client_id uuid;
begin
  select b.shoot_id, s.client_id
    into v_shoot_id, v_client_id
  from bids b
  join shoots s on s.id = b.shoot_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and s.status = 'open'
    and s.accepted_bid_id is null
  for update of b, s;

  if v_shoot_id is null then
    raise exception 'bid not acceptable';
  end if;

  if v_client_id is distinct from auth.uid() then
    raise exception 'not your shoot';
  end if;

  update bids set status = 'accepted' where id = p_bid_id;

  update bids set status = 'declined'
  where shoot_id = v_shoot_id and id <> p_bid_id and status = 'pending';

  -- This open->assigned transition (with accepted_bid_id set) is explicitly
  -- permitted by the shoots_status_guard trigger below.
  update shoots set status = 'assigned', accepted_bid_id = p_bid_id
  where id = v_shoot_id;
end;
$$;

-- ── FIX 1b: shoots status-transition + accepted_bid_id tamper guard ──
-- Enforces legal status FSM transitions and prevents client-driven
-- accepted_bid_id mutations.
drop trigger if exists shoots_status_guard on public.shoots;

create or replace function public.shoots_status_guard()
returns trigger
language plpgsql
as $$
begin
  -- Guard: accepted_bid_id must not change except during open->assigned transition.
  -- accept_bid (SECURITY DEFINER) does exactly: OLD.status='open', NEW.status='assigned'.
  if NEW.accepted_bid_id is distinct from OLD.accepted_bid_id then
    if NOT (OLD.status = 'open' and NEW.status = 'assigned') then
      raise exception 'accepted_bid_id is managed by accept_bid'
        using errcode = 'P0001';
    end if;
  end if;

  -- Guard: enforce legal status transitions.
  -- Allowed: same-state stays, open->cancelled, assigned->cancelled,
  --          assigned->completed, and the accept_bid open->assigned path.
  -- Forbidden: assigned->open, anything from completed/cancelled changing.
  if OLD.status = NEW.status then
    -- same-state: always allowed (e.g. editing title on an open shoot)
    return NEW;
  end if;

  if (OLD.status = 'open'      and NEW.status = 'cancelled')  or
     (OLD.status = 'open'      and NEW.status = 'assigned')   or
     (OLD.status = 'assigned'  and NEW.status = 'cancelled')  or
     (OLD.status = 'assigned'  and NEW.status = 'completed')  then
    return NEW;
  end if;

  raise exception 'illegal shoot status transition'
    using errcode = 'P0001';
end;
$$;

create trigger shoots_status_guard
  before update on public.shoots
  for each row execute function public.shoots_status_guard();

-- ── FIX 2: bids immutable shoot_id / photographer_id ────────────────
-- Prevents a photographer from moving a pending bid to a different shoot.
drop trigger if exists bids_immutable_guard on public.bids;

create or replace function public.bids_immutable_guard()
returns trigger
language plpgsql
as $$
begin
  if NEW.shoot_id is distinct from OLD.shoot_id or
     NEW.photographer_id is distinct from OLD.photographer_id then
    raise exception 'bid shoot_id and photographer_id are immutable'
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create trigger bids_immutable_guard
  before update on public.bids
  for each row execute function public.bids_immutable_guard();
