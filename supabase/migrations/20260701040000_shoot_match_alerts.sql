-- Shoot match alerts: when a client posts a new OPEN shoot, email every
-- photographer whose coverage canton + discipline match, so they get leads
-- instead of having to poll. This is the retention loop that makes a future
-- subscription worth renewing. Mirrors the notify_bid_received SECURITY
-- DEFINER trigger pattern — the enqueue bypasses email_outbox's
-- service-role-only RLS as the definer, same as that precedent.

-- GIN index for the coverage_cantons array-containment match below.
create index if not exists photographer_details_coverage_cantons_idx
  on public.photographer_details using gin (coverage_cantons);

create or replace function public.notify_matching_photographers()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'open' then
    insert into email_outbox (recipient_id, kind, shoot_id, shoot_title)
    select pd.profile_id, 'shoot_match', new.id, new.title
    from photographer_details pd
    join profiles p on p.id = pd.profile_id
    where new.canton = any (pd.coverage_cantons)
      and new.discipline = any (pd.disciplines)
      and coalesce(p.notify_shoot_updates, true) = true
      and not p.is_suspended
      and pd.profile_id <> new.client_id;
  end if;
  return new;
end;
$$;

create trigger on_shoot_insert_notify_matching_photographers
  after insert on public.shoots
  for each row execute function public.notify_matching_photographers();
