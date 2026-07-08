-- Integrity constraints from 20260624000000_integrity_constraints.sql:
-- bounded email_outbox.status, bounded audit_log action/target_type, and
-- existence validation of polymorphic report targets.
begin;
create extension if not exists pgtap;

select plan(7);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'integ-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Integrity Client"}', now(), now());

-- ── email_outbox.status ──────────────────────────────────────────────
select throws_ok(
  $$insert into public.email_outbox (recipient_id, kind, status)
    values ('00000000-0000-0000-0000-0000000000e1', 'bid_received', 'bogus')$$,
  '23514', null, 'email_outbox rejects an unknown status'
);
select lives_ok(
  $$insert into public.email_outbox (recipient_id, kind, status)
    values ('00000000-0000-0000-0000-0000000000e1', 'bid_received', 'pending')$$,
  'email_outbox accepts a valid status'
);

-- ── audit_log action / target_type ───────────────────────────────────
select throws_ok(
  $$insert into public.audit_log (action, target_type, target_id)
    values ('x', 'bogus', '00000000-0000-0000-0000-0000000000e1')$$,
  '23514', null, 'audit_log rejects an unknown target_type'
);
select throws_ok(
  $$insert into public.audit_log (action, target_type, target_id)
    values ('', 'profile', '00000000-0000-0000-0000-0000000000e1')$$,
  '23514', null, 'audit_log rejects an empty action'
);
select lives_ok(
  $$insert into public.audit_log (action, target_type, target_id)
    values ('test_action', 'profile', '00000000-0000-0000-0000-0000000000e1')$$,
  'audit_log accepts a valid action + target_type'
);

-- ── reports.target_id existence validation ───────────────────────────
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-0000000000e1', 'profile',
            '00000000-0000-0000-0000-0000000000ee', 'Nonexistent target.')$$,
  'P0001', null, 'reports rejects a target_id that does not exist'
);
select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-0000000000e1', 'profile',
            '00000000-0000-0000-0000-0000000000e1', 'Valid existing target.')$$,
  'reports accepts an existing target'
);

select * from finish();
rollback;
