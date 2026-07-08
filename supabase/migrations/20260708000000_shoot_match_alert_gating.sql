-- P5b — gate the instant shoot_match EMAIL to standard/premium photographers.
--
-- Tier -> alert policy: free -> in-app bell only. basic -> bell + a once-daily
-- digest email (scanShootMatchDigest in src/lib/lifecycle.ts), NOT this instant
-- email. standard/premium -> bell + this instant email. So the ONLY change
-- here is adding a tier filter to the email_outbox insert inside
-- notify_matching_photographers(); the notifications (bell) insert is left
-- byte-for-byte identical so every tier keeps getting the in-app alert.
--
-- Per 20260707000000_subscriptions.sql's "anti-drift" comment, tier reads must
-- go through public.photographer_effective_tier (which collapses an expired
-- plan_expires_at to 'free'), never raw photographer_details.plan_tier —
-- otherwise a photographer whose paid plan lapsed would keep getting instant
-- emails until something else touched plan_tier.
--
-- `create or replace function` does not drop the existing trigger
-- (on_shoot_insert_or_update_notify_matching_photographers, created in
-- 20260701060000_shoot_match_notification.sql), so it is left untouched here
-- and continues to fire this function after insert or update on shoots.

create or replace function public.notify_matching_photographers()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and new.status = 'open')
     or (TG_OP = 'UPDATE' and new.status = 'open' and old.status is distinct from 'open') then
    insert into email_outbox (recipient_id, kind, shoot_id, shoot_title)
    select pd.profile_id, 'shoot_match', new.id, new.title
    from photographer_details pd
    join profiles p on p.id = pd.profile_id
    join photographer_effective_tier et on et.profile_id = pd.profile_id
    where pd.coverage_cantons @> array[new.canton]::public.canton[]
      and new.discipline = any (pd.disciplines)
      and coalesce(p.notify_shoot_updates, true) = true
      and not p.is_suspended
      and pd.profile_id <> new.client_id
      and et.effective_tier in ('standard','premium');

    insert into notifications (user_id, type, shoot_id)
    select pd.profile_id, 'shoot_match', new.id
    from photographer_details pd
    join profiles p on p.id = pd.profile_id
    where pd.coverage_cantons @> array[new.canton]::public.canton[]
      and new.discipline = any (pd.disciplines)
      and coalesce(p.notify_shoot_updates, true) = true
      and not p.is_suspended
      and pd.profile_id <> new.client_id;
  end if;
  return new;
end;
$$;
