-- Tier A — data-integrity hardening (gap assessment A8).
-- Three small, defense-in-depth fixes. No column types change, so
-- database.types.ts is unaffected.

-- 1. accepted_bid_id had no ON DELETE behaviour. If the referenced bid is ever
--    removed, the shoot would keep a dangling reference (get_counterparty_email
--    and the detail page resolve the accepted bid via this column). SET NULL is
--    correct: a shoot can exist without an accepted bid, but must never point at
--    a bid that no longer exists. (A bid is normally only removed when its shoot
--    is deleted, which cascades the shoot away anyway — this guards the rare
--    direct-delete / future-admin-takedown path.)
alter table public.shoots
  drop constraint shoots_accepted_bid_fk;

alter table public.shoots
  add constraint shoots_accepted_bid_fk
  foreign key (accepted_bid_id) references public.bids (id) on delete set null;

-- The shoots_status_guard trigger (20260613010720) blocks ANY change to
-- accepted_bid_id outside the open->assigned transition. That makes the SET NULL
-- above impossible AND — pre-existing latent bug — it makes the original NO ACTION
-- FK reject the cascade when a photographer with an accepted bid deletes their
-- account (deleteAccount → cascade delete their bid → FK violation). Relax the
-- guard so CLEARING accepted_bid_id to NULL is allowed (legitimate cleanup when
-- the referenced bid is removed), while SETTING it to a (different) non-null bid
-- remains restricted to accept_bid's open->assigned path. Tamper protection and
-- the status FSM are otherwise unchanged.
create or replace function public.shoots_status_guard()
returns trigger
language plpgsql
as $$
begin
  -- accepted_bid_id may only be SET (to a non-null bid) during open->assigned
  -- (accept_bid, SECURITY DEFINER). Clearing it to NULL is permitted so the
  -- ON DELETE SET NULL FK can null it when the referenced bid is removed.
  if NEW.accepted_bid_id is distinct from OLD.accepted_bid_id then
    if NEW.accepted_bid_id is not null
       and NOT (OLD.status = 'open' and NEW.status = 'assigned') then
      raise exception 'accepted_bid_id is managed by accept_bid'
        using errcode = 'P0001';
    end if;
  end if;

  -- Enforce legal status transitions (unchanged).
  if OLD.status = NEW.status then
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

-- 2. Sanity ceilings on money columns. amount_chf / budget already guard the
--    lower bound (> 0); add an upper bound so a buggy or malicious client cannot
--    insert absurd values (overflow-adjacent, UI-breaking). 1'000'000 CHF mirrors
--    the existing application cap in createBidSchema (.max(1000000)); a single
--    photography engagement never legitimately exceeds it. budget_min is bounded
--    transitively (budget_min <= budget_max via the existing budget_range check).
alter table public.bids
  add constraint bids_amount_max check (amount_chf <= 1000000);

alter table public.shoots
  add constraint shoots_budget_max_ceiling check (budget_max_chf <= 1000000);

-- NOTE (deliberate non-change): we do NOT force an accepted bid to fall within
-- the shoot's stated budget range. Photographers legitimately bid above (premium)
-- or below the range, and accepting such a bid is the client's explicit, informed
-- choice. Constraining it at accept time would block real bookings.
