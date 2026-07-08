-- Admin alerting (gap D2 part 1): a new report or dispute currently sits
-- silently until the owner happens to check /admin. Enqueue an
-- 'admin_alert' email (via the existing email_outbox) to every admin
-- profile whenever a report or dispute is filed, so moderation isn't purely
-- reactive. email_outbox.kind is plain text (no enum), so no type change is
-- needed — only the two triggers below plus the email.ts rendering (kind,
-- COPY, link()) added alongside this migration.

-- ── reports → admins ─────────────────────────────────────────────────
create or replace function public.notify_admins_on_report()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.email_outbox (recipient_id, kind, shoot_id, shoot_title)
  select p.id, 'admin_alert', null, null
  from public.profiles p
  where p.is_admin = true;
  return new;
end;
$$;

create trigger on_report_insert
  after insert on public.reports
  for each row execute function public.notify_admins_on_report();

-- ── disputes → admins ────────────────────────────────────────────────
create or replace function public.notify_admins_on_dispute()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.email_outbox (recipient_id, kind, shoot_id, shoot_title)
  select p.id, 'admin_alert', null, null
  from public.profiles p
  where p.is_admin = true;
  return new;
end;
$$;

create trigger on_dispute_insert
  after insert on public.disputes
  for each row execute function public.notify_admins_on_dispute();
