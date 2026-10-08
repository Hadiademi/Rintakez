-- Close the lifecycle candidate readers to every role but service_role.
--
-- 20260903120000 revoked EXECUTE from PUBLIC and granted service_role, but
-- Supabase's default ACL also grants EXECUTE on new functions to anon and
-- authenticated EXPLICITLY — those grants survive a revoke from PUBLIC. Found
-- by post-deploy verification on 2026-10-08: any visitor could call the three
-- readers through PostgREST RPC and enumerate non-onboarded photographer ids
-- and the ids/titles of completed shoots awaiting review.
--
-- Only the cron's admin client calls these (src/lib/lifecycle.ts), so no app
-- path loses access. grants_hardening.test.sql now asserts this for every
-- lifecycle_* / admin_* function, current and future.
revoke all on function public.lifecycle_onboarding_candidates(timestamptz, integer) from anon, authenticated;
revoke all on function public.lifecycle_zero_bid_candidates(timestamptz, integer) from anon, authenticated;
revoke all on function public.lifecycle_review_request_candidates(timestamptz, integer) from anon, authenticated;
