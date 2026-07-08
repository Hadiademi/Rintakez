-- Notify photographers of the two highest-stakes events that were previously
-- silent: receiving a review, and an admin verification decision. In-app only
-- (created by SECURITY DEFINER triggers so they cannot be forged).

alter type public.notification_type add value if not exists 'review_received';
alter type public.notification_type add value if not exists 'verification_approved';
alter type public.notification_type add value if not exists 'verification_rejected';

-- New review -> notify the reviewed photographer.
create or replace function public.notify_review_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, type, shoot_id)
  values (new.photographer_id, 'review_received', new.shoot_id);
  return new;
end;
$$;

create trigger on_review_insert
  after insert on public.reviews
  for each row execute function public.notify_review_received();

-- Verification decision -> notify the photographer (verified or rejected).
create or replace function public.notify_verification_decision()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and new.verification_status in ('verified', 'rejected') then
    insert into notifications (user_id, type)
    values (
      new.profile_id,
      case when new.verification_status = 'verified'
           then 'verification_approved'::notification_type
           else 'verification_rejected'::notification_type end
    );
  end if;
  return new;
end;
$$;

create trigger on_verification_decision
  after update on public.photographer_details
  for each row execute function public.notify_verification_decision();
