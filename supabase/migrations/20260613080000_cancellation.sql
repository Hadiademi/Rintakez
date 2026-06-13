-- Booking cancellation: capture an optional reason and notify the assigned
-- photographer when a confirmed booking (assigned shoot) is cancelled.

alter table public.shoots add column cancellation_reason text;

alter type public.notification_type add value if not exists 'shoot_cancelled';

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
  end if;
  return new;
end;
$$;

create trigger shoot_cancelled_notify
  after update on public.shoots
  for each row execute function public.notify_shoot_cancelled();
