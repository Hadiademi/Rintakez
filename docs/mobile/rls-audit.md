# RLS Direct-Connection Audit

Goal: every `public` table must be safe when a user connects directly to
Supabase with their JWT (the native-app path), not only through server actions.

Method: for each table, confirm `alter table … enable row level security` is
present and that SELECT/INSERT/UPDATE/DELETE policies scope rows to the actor.
Verified by `supabase/tests/database/direct_connection_rls.test.sql` plus the
pre-existing `rls.test.sql`, `messaging_reviews.test.sql`, and
`reliability.test.sql`.

| Table | RLS on | Read scoped | Write scoped | Notes |
|-------|--------|-------------|--------------|-------|
| profiles | ☑ | ☑ | ☑ | public read of display fields; self-write; is_admin/is_suspended excluded from column grant. Verified: rls.test.sql tests 19, 73. |
| photographer_details | ☑ | ☑ | ☑ | public read; photographer-only self-write. Verified: rls.test.sql (schema/policy audit); direct_connection_rls.test.sql test 5 (cross-user insert denial). |
| portfolio_images | ☑ | ☑ | ☑ | public read; photographer inserts/deletes own rows. Verified: rls.test.sql (policy audit); direct_connection_rls.test.sql test 6 (cross-user insert denial). |
| shoots | ☑ | ☑ | ☑ | open + unsuspended shoots public; owner-write; column grant limits to status/cancellation_reason. Verified: rls.test.sql tests 6, 20, 22-23. |
| bids | ☑ | ☑ | ☑ | photographer-owned or shoot-client can read; photographer-only insert scoped to auth.uid(); submit_bid path. Verified: rls.test.sql tests 7-12; direct_connection_rls.test.sql tests 1-2. |
| conversations | ☑ | ☑ | ☑ | participants-only SELECT; UPDATE moved to mark_conversation_read() SECURITY DEFINER (direct column grant revoked in 20260630050000_hardening.sql). Verified: rls.test.sql tests 61-62; messaging_reviews.test.sql tests 4-5, 9. |
| messages | ☑ | ☑ | ☑ | participant-only SELECT; participant+unsuspended INSERT; sender_id must match auth.uid(). Verified: rls.test.sql tests 63-67; messaging_reviews.test.sql tests 4-8. |
| notifications | ☑ | ☑ | ☑ | recipient only; mark-read UPDATE scoped to user_id = auth.uid(). Verified: rls.test.sql tests 41-47. |
| reviews | ☑ | ☑ | ☑ | public read; INSERT restricted to owning client on a completed shoot with the assigned photographer. Verified: messaging_reviews.test.sql tests 12-17. |
| favorites | ☑ | ☑ | ☑ | owner only for SELECT/INSERT/DELETE. Verified: rls.test.sql tests 75-76. |
| photographer_unavailable | ☑ | ☑ | ☑ | public read; photographer-only INSERT for future dates (date guard added in 20260630050000_hardening.sql); DELETE own. Verified: rls.test.sql tests 78-79. |
| reports | ☑ | ☑ | ☑ | reporter-only SELECT; INSERT scoped to reporter_id = auth.uid(), suspension-gated. Verified: rls.test.sql tests 70-72. |
| disputes | ☑ | ☑ | ☑ | party-only SELECT/INSERT. Verified: disputes.test.sql. |
| user_blocks | ☑ | ☑ | ☑ | owner-only SELECT/INSERT/DELETE. Verified: blocks.test.sql. |
| audit_log | ☑ | ☑ | ☑ | no anon/authenticated grants; service_role only (RLS + no grant = complete denial). Verified: policy audit (20260622010000_moderation.sql); direct_connection_rls.test.sql test 4 (authenticated-read denial). |
| email_outbox | ☑ | ☑ | ☑ | service-role only; no grants to authenticated/anon. Verified: reliability.test.sql test 2; direct_connection_rls.test.sql test 3. |
| shoot_images | ☑ | ☑ | ☑ | shoot-owner INSERT/DELETE; SELECT follows shoot visibility (open shoots public). Verified: rls.test.sql tests 30-39. |

Fill each box as verified. Any gap → add a policy migration + a failing→passing
pgTAP assertion before ticking it.

## Pre-existing failing tests — determination

Five assertions were failing before this task. Each is characterized below.

### messaging_reviews.test.sql — test 10: "client can update their own last-read marker"

**Determination: STALE TEST (no security gap).**

The test calls:
```sql
update public.conversations set client_last_read_at = now()
  where shoot_id = '…'
```

Migration `20260630050000_hardening.sql` deliberately revoked the column-scoped
`UPDATE` grant on `conversations` from `authenticated` and replaced it with the
`mark_conversation_read(uuid)` SECURITY DEFINER function. The function only ever
sets the caller's own side, preventing badge-count spoofing. The test was written
before the hardening and was never updated. The policy `conversations_update_participant`
still exists but the table-level UPDATE privilege is gone, so the RLS policy is
unreachable and the test correctly errors — it is the test, not the policy, that
is wrong.

**No security gap.** The column grant was intentionally removed.

### rls.test.sql — test 49: "client completes own assigned shoot"

**Determination: STALE TEST (no security gap).**

Migration `20260630010000_booking_integrity.sql` added a date guard to
`complete_shoot()`:
```sql
and shoot_date <= current_date
```

The test fixture uses `shoot_date = '2027-08-14'` (far in the future), so the
function correctly returns `cannot complete shoot`. The behavior is intentional:
a client cannot mark a shoot completed before the day arrives. The test fixture
dates must be set to `current_date` or in the past for this test to pass. This
is a test-data staleness issue, not a bug.

**No security gap.** The date guard is correct behavior.

### rls.test.sql — tests 53-55: review insertion and rating view

**Determination: STALE TEST cascade from test 49 (no security gap).**

- Test 53 ("client reviews the assigned photographer") fails because the shoot
  was never transitioned to `completed` (test 49 failed), so `reviews_insert_client`
  correctly blocks the INSERT via its `s.status = 'completed'` check.
- Test 54 ("one review per shoot") receives a RLS denial instead of a unique
  constraint because the first insert (test 53) also failed.
- Test 55 ("photographer_ratings view counts the review") returns NULL because
  the review from test 53 was never inserted.

All three are cascading failures from the stale fixture date in test 49.

**No security gap.** The RLS policies are correct.
