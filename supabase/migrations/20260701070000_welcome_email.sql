-- Welcome email (Task C2, lifecycle emails). A profile row is created exactly
-- once per signup (public.handle_new_user(), 20260613005039_schema.sql), so an
-- AFTER INSERT trigger on public.profiles is the natural, idempotent-by-
-- construction place to enqueue the 'welcome' email — it fires once and only
-- once per new account. SECURITY DEFINER + search_path pinned, mirroring the
-- other notification/email-enqueue triggers (e.g. notify_shoot_invitation,
-- notify_matching_photographers).

create or replace function public.enqueue_welcome_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.email_outbox (recipient_id, kind)
  values (new.id, 'welcome');
  return new;
end;
$$;

create trigger on_profile_insert_welcome_email
  after insert on public.profiles
  for each row execute function public.enqueue_welcome_email();
