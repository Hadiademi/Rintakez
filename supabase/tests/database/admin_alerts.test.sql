-- Admin alerting from 20260701100000_admin_alerts.sql (gap D2 part 1): a new
-- report or dispute enqueues an 'admin_alert' email_outbox row for every
-- is_admin=true profile, so moderation isn't purely "whenever the owner
-- happens to check /admin".
begin;
create extension if not exists pgtap;

select plan(4);

-- ── fixtures: 1 admin + 1 client + 1 photographer + 1 assigned shoot ────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e0', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admn@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Admin One"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alrtc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Alert Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alrtf@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Alert Photographer"}', now(), now());

-- Promote E0 to admin (out-of-band, as real admins are).
update public.profiles set is_admin = true
  where id = '00000000-0000-0000-0000-0000000000e0';

-- An assigned shoot (client E1, accepted photographer E2) so a dispute is
-- allowed to be opened on it.
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e1',
   'Alert shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000e4', '10000000-0000-0000-0000-0000000000e3',
   '00000000-0000-0000-0000-0000000000e2', 700, 'Accepted bid.');

update public.shoots
  set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000e4'
  where id = '10000000-0000-0000-0000-0000000000e3';

-- ── 1: filing a report enqueues an admin_alert for the admin ─────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
insert into public.reports (reporter_id, target_type, target_id, reason)
values ('00000000-0000-0000-0000-0000000000e1', 'profile',
        '00000000-0000-0000-0000-0000000000e2', 'Suspicious behaviour.');
reset role;

select results_eq(
  $$select count(*)::int from public.email_outbox
      where recipient_id = '00000000-0000-0000-0000-0000000000e0'
        and kind = 'admin_alert'$$,
  array[1],
  'filing a report enqueues one admin_alert row for the admin'
);

-- ── 2: the alert is not addressed to a non-admin ─────────────────────
select results_eq(
  $$select count(*)::int from public.email_outbox
      where recipient_id = '00000000-0000-0000-0000-0000000000e1'
        and kind = 'admin_alert'$$,
  array[0],
  'the reporting (non-admin) client does not receive an admin_alert'
);

-- ── 3: opening a dispute enqueues a second admin_alert for the admin ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
insert into public.disputes (shoot_id, opened_by, reason)
values ('10000000-0000-0000-0000-0000000000e3',
        '00000000-0000-0000-0000-0000000000e2', 'Client never showed up.');
reset role;

select results_eq(
  $$select count(*)::int from public.email_outbox
      where recipient_id = '00000000-0000-0000-0000-0000000000e0'
        and kind = 'admin_alert'$$,
  array[2],
  'opening a dispute enqueues a second admin_alert row for the admin'
);

-- ── 4: the email_outbox stays service-role only (not readable by the admin) ──
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e0","role":"authenticated"}';
select throws_ok(
  $$select * from public.email_outbox$$,
  '42501',
  null,
  'even the admin profile cannot read email_outbox directly (service-role only)'
);
reset role;

select * from finish();
rollback;
