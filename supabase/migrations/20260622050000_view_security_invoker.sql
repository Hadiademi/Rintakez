-- Supabase Security Advisor (CRITICAL): photographer_ratings was created without
-- security_invoker, so a view runs with its owner's privileges and BYPASSES the
-- querying user's RLS. Switch it to security_invoker so it honours RLS like a
-- normal query. Behaviour is unchanged today (reviews are public via
-- reviews_select_all USING (true) and anon/authenticated hold SELECT on reviews),
-- but this is the correct, future-proof posture and clears the advisor finding.
alter view public.photographer_ratings set (security_invoker = true);
