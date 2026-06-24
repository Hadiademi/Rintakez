-- Data-integrity constraints (#21). Bound the free-text status/type columns and
-- validate polymorphic report targets so bad data cannot be written even through
-- the service-role code paths.

-- email_outbox.status: only the three states the drainer/admin retry ever set.
alter table public.email_outbox
  add constraint email_outbox_status_chk
  check (status in ('pending', 'sent', 'failed'));

-- audit_log: action must be non-empty and bounded; target_type is limited to the
-- object kinds actually written (admin actions, account deletion, accept_bid).
alter table public.audit_log
  add constraint audit_log_action_chk
  check (char_length(action) between 1 and 100);
alter table public.audit_log
  add constraint audit_log_target_type_chk
  check (target_type in ('profile', 'shoot', 'report', 'dispute'));

-- reports.target_id is polymorphic (profile|shoot), so no FK is possible.
-- Validate that the referenced row actually exists for its type, so a report
-- cannot dangle or point at the wrong kind of object. SECURITY DEFINER so it can
-- see rows the reporter's RLS would hide; a BEFORE trigger runs before the RLS
-- WITH CHECK, so legitimate ownership denials still surface as 42501.
create or replace function public.reports_validate_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'profile' then
    if not exists (select 1 from public.profiles where id = new.target_id) then
      raise exception 'report target not found' using errcode = 'P0001';
    end if;
  elsif new.target_type = 'shoot' then
    if not exists (select 1 from public.shoots where id = new.target_id) then
      raise exception 'report target not found' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.reports_validate_target() from public;

create trigger reports_validate_target_trg
  before insert on public.reports
  for each row execute function public.reports_validate_target();
