-- Review fixes for shoot_match alerts (20260701040000):
--
-- FIX 1 — in-app parity: a matched photographer previously got only an email,
-- no bell entry. Now also insert a `notifications` row (type 'shoot_match')
-- per matched photographer, same predicate as the email_outbox enqueue. The
-- 'shoot_match' enum value was added in the prior migration file
-- (20260701050000_shoot_match_enum.sql) since a value added by ALTER TYPE
-- cannot safely be used in the same transaction it was added in.
--
-- FIX 2 — fire on reopen: the trigger now runs `after insert or update` and
-- fans out when the shoot BECOMES open — either a brand new open shoot, or an
-- assigned shoot reopening (the booking_integrity orphan-reopen path). This
-- re-alerts photographers when a shoot reopens.
--
-- FIX 3 — make the GIN index usable: `= any(pd.coverage_cantons)` cannot use
-- a GIN index on coverage_cantons. Rewritten as the containment form
-- `pd.coverage_cantons @> array[new.canton]` so the existing
-- photographer_details_coverage_cantons_idx is actually used. Behavior is
-- identical (single-canton containment == membership test).

drop trigger if exists on_shoot_insert_notify_matching_photographers on public.shoots;

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
    where pd.coverage_cantons @> array[new.canton]::public.canton[]
      and new.discipline = any (pd.disciplines)
      and coalesce(p.notify_shoot_updates, true) = true
      and not p.is_suspended
      and pd.profile_id <> new.client_id;

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

create trigger on_shoot_insert_or_update_notify_matching_photographers
  after insert or update on public.shoots
  for each row execute function public.notify_matching_photographers();
