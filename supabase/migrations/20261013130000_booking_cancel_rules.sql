set local lock_timeout = '5s';

-- Booking cancellation rules.
--
-- shoots_status_guard allows assigned -> cancelled at any time. That was
-- harmless while the UI only offered "cancel" on open shoots, but a client
-- may now call off a booking from the shoot page. Without limits a client
-- could cancel a job AFTER it was delivered, even during an open dispute:
-- the dispute disappeared from both sides' pages (they only show disputes of
-- assigned/completed shoots), the photographer could not open a new one (the
-- insert policy requires assigned/completed), and the job dropped out of the
-- photographer's public completed count.
--
-- So a signed-in user may cancel a booking only:
--   * before the shoot day (Europe/Zurich calendar date) — on and after the
--     day, the shoot is completed or disputed instead;
--   * while no dispute about it is open.
-- Admin tooling (service role / postgres) is not limited. Open shoots that
-- were never booked can still be cancelled at any time.
create or replace function public.enforce_booking_cancel_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    return new;
  end if;
  if old.status = 'assigned' and new.status = 'cancelled' then
    if old.shoot_date <= (now() at time zone 'Europe/Zurich')::date then
      raise exception 'booking_past' using errcode = 'P0001';
    end if;
    if exists (select 1 from disputes d where d.shoot_id = old.id and d.status = 'open') then
      raise exception 'dispute_open' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger shoots_booking_cancel_rules
  before update of status on public.shoots
  for each row execute function public.enforce_booking_cancel_rules();

revoke all on function public.enforce_booking_cancel_rules() from public, anon, authenticated;
