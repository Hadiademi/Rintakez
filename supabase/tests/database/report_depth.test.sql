-- Report depth (20260701110000_report_target_values.sql /
-- 20260701120000_report_category.sql): reports can now target a review or a
-- message (not just profile/shoot), and carry a category alongside the
-- free-text reason.
begin;
create extension if not exists pgtap;

select plan(8);

-- ── fixtures: 1 client + 1 photographer + 1 completed shoot + 1 review ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rdc@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Report Depth Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rdp@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Report Depth Photographer"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d1',
   'Report depth shoot', 'portrait', 'Brief long enough.', 'Bern', 'BE',
   '2027-12-01', 2, 500, 900);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-0000000000d4', '10000000-0000-0000-0000-0000000000d3',
   '00000000-0000-0000-0000-0000000000d2', 700, 'Accepted bid.');

-- open -> assigned (sets accepted_bid_id) in one step, then assigned ->
-- completed in a second step, matching the shoots_status_guard FSM: it only
-- allows accepted_bid_id to change during the open->assigned transition.
update public.shoots
  set status = 'assigned', accepted_bid_id = '20000000-0000-0000-0000-0000000000d4'
  where id = '10000000-0000-0000-0000-0000000000d3';

update public.shoots
  set status = 'completed'
  where id = '10000000-0000-0000-0000-0000000000d3';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
insert into public.reviews (id, shoot_id, client_id, photographer_id, rating, comment)
values
  ('30000000-0000-0000-0000-0000000000d5', '10000000-0000-0000-0000-0000000000d3',
   '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
   4, 'Good session.');
reset role;

-- ── 1: report_target now accepts 'review' ────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason, category)
    values ('00000000-0000-0000-0000-0000000000d2', 'review',
            '30000000-0000-0000-0000-0000000000d5', 'Unfair review.', 'harassment')$$,
  'an authenticated user can report a review with an explicit category'
);
reset role;

-- ── 2: the category was stored as given ───────────────────────────────
select results_eq(
  $$select category::text from public.reports
      where target_type = 'review'
        and target_id = '30000000-0000-0000-0000-0000000000d5'$$,
  array['harassment'],
  'the chosen category is persisted on the report row'
);

-- ── 3: report_target now accepts 'message' ────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason, category)
    values ('00000000-0000-0000-0000-0000000000d1', 'message',
            gen_random_uuid(), 'Spammy message.', 'spam')$$,
  'an authenticated user can report a message'
);
reset role;

-- ── 4: category defaults to 'other' when omitted ──────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-0000000000d1', 'profile',
            '00000000-0000-0000-0000-0000000000d2', 'No category given.')$$,
  'category defaults when not supplied'
);
reset role;

select results_eq(
  $$select category::text from public.reports
      where reporter_id = '00000000-0000-0000-0000-0000000000d1'
        and target_type = 'profile'
        and reason = 'No category given.'$$,
  array['other'],
  'the default category is other'
);

-- ── 5: an invalid category is rejected by the enum ────────────────────
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason, category)
    values ('00000000-0000-0000-0000-0000000000d1', 'profile',
            '00000000-0000-0000-0000-0000000000d2', 'Bad category.', 'not_a_real_category')$$,
  '22P02',
  null,
  'an unknown category value is rejected'
);

-- ── 6: reporter_id still cannot be spoofed for the new target types ────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason, category)
    values ('00000000-0000-0000-0000-0000000000d1', 'message',
            gen_random_uuid(), 'Spoofed reporter.', 'spam')$$,
  '42501',
  null,
  'cannot file a review/message report as another user'
);
reset role;

-- ── 7: report_target now has exactly the 4 expected labels ────────────
select set_eq(
  $$select enumlabel::text from pg_enum
      where enumtypid = 'public.report_target'::regtype$$,
  ARRAY['profile', 'shoot', 'review', 'message'],
  'report_target enum contains exactly profile, shoot, review, message'
);

select * from finish();
rollback;
