-- Grants hardening: close the table-level privileges Supabase's default ACL
-- hands every new public table, which several migrations never revoked.
--
-- WHAT WAS WRONG
-- --------------
-- Supabase's default privileges grant ALL on every new table in `public` to
-- anon and authenticated. RLS is the primary boundary and still held — no data
-- leaked — but four tables relied on COLUMN-scoped intent that the default
-- TABLE-level UPDATE grant silently overrode, because a column grant is moot
-- while the table grant exists:
--
--   * reviews — the photographer-reply policy (photographer_id = auth.uid()
--     AND reply IS NULL) let a photographer rewrite ANY column of a review
--     about themselves, including `rating`, via a direct PostgREST PATCH.
--     Verified locally: a 5-star review was set to 1 by its photographer. This
--     is the reputation system's integrity, so it is the headline fix.
--   * conversations — a participant could rewrite client_id/photographer_id,
--     dragging an arbitrary user into a thread (messaging without an accepted
--     bid). The app never updates conversations directly; read receipts go
--     through SECURITY DEFINER mark_conversation_read().
--   * portfolio_images — own rows, but any column (e.g. storage_path pointing
--     at another photographer's file). The app writes caption and sort_order.
--   * notifications — own rows, any column. The app writes read_at only.
--
-- Plus defense in depth the pgTAP suite already asserted but the default ACL
-- had undone: service-role-only tables (email_outbox, lifecycle_email_log,
-- stripe_events, audit_log) and admin_liquidity_stats() were reachable by
-- anon/authenticated at the privilege layer (RLS / no policies kept rows
-- hidden; the aggregate function had no guard and returned business stats).
--
-- WHY THE SUITE DIDN'T CATCH IT EARLIER: the old local stack did not carry the
-- platform default ACL, so local grants were stricter than production's. The
-- current image matches production, and the pgTAP job now runs on every push.
--
-- Every grant below is mapped from an actual `.update()` / read call site in
-- src/ — nothing the app does loses a privilege it uses.

-- ── 1. Column-scoped writes: revoke the table-level UPDATE, grant only the
--       columns the app writes. RLS policies are unchanged. ────────────────
revoke update on public.reviews from anon, authenticated;
grant update (reply, reply_at) on public.reviews to authenticated;

revoke update on public.conversations from anon, authenticated;

revoke update on public.portfolio_images from anon, authenticated;
grant update (caption, sort_order) on public.portfolio_images to authenticated;

revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ── 2. Service-role-only tables. Read and written exclusively through the
--       admin client (cron, webhook, admin pages, audit writer). ───────────
revoke all on public.email_outbox from anon, authenticated;
revoke all on public.lifecycle_email_log from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

-- subscriptions: the signed-in user reads their OWN row (RLS) for the quota
-- and billing panel; every write is service-role (webhook / admin comp).
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

-- profile_views: owners read their own rows (RLS); rows are only ever created
-- by the SECURITY DEFINER record_profile_view() RPC.
revoke all on public.profile_views from anon;
revoke insert, update, delete on public.profile_views from authenticated;

-- ── 3. Admin aggregate: service-role only (the admin page calls it through
--       createAdminClient). Revoke from PUBLIC first — a function's default
--       EXECUTE goes to PUBLIC, so revoking only named roles leaves it open.
revoke all on function public.admin_liquidity_stats() from public, anon, authenticated;
grant execute on function public.admin_liquidity_stats() to service_role;

-- current_profile() returns the CALLER's own full row (auth.uid()-scoped), so
-- anon gets nothing from it — but the column-privacy suite asserts anon cannot
-- even execute it, and the default ACL had restored that. Both call sites
-- (getProfile, the profile page) run only after a session check.
revoke all on function public.current_profile() from public, anon;
grant execute on function public.current_profile() to authenticated;

-- ── 4. Blanket hygiene, applies to every current table. anon never writes a
--       table directly (anonymous writes go through SECURITY DEFINER RPCs), and
--       TRUNCATE / REFERENCES / TRIGGER / MAINTAIN are never used by app roles —
--       TRUNCATE in particular is not subject to RLS. ──────────────────────────
revoke insert, update, delete on all tables in schema public from anon;
revoke truncate, references, trigger, maintain on all tables in schema public from anon, authenticated;
