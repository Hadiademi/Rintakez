-- Insert grants hardening: a signed-in user may INSERT only the columns the
-- app's own server actions write.
--
-- WHAT WAS WRONG
-- --------------
-- 20261008120000 narrowed UPDATE, but Supabase's default ACL also grants
-- table-level INSERT on every public table, and the insert policies only check
-- ownership. Through PostgREST with their own JWT a user could:
--   * shoots: insert a shoot that is already 'completed' (or 'assigned') with
--     any bid they can see as accepted_bid_id. That unlocked unlimited reviews
--     of that photographer, get_counterparty_email() without accepting, an
--     inflated completed-shoots count, and an 'already booked' block on the
--     photographer's date. This is the headline fix.
--   * reviews: write the photographer's public "reply" in their own review;
--     the real photographer could then never reply (reply IS NULL gate).
--   * disputes / reports: file them already resolved or closed, so they never
--     reach the admin queue.
--   * bids: insert a self-accepted bid (inflating acceptance stats), or a
--     backdated one that the quota counter shown in the app no longer counts.
--     NOTE: the monthly quota itself is still enforced only in the server
--     action; a DB-side quota check is a separate follow-up (review SEC-04).
--   * messages: backdate or future-date created_at (pins a thread on top).
-- Found by the 2026-10-10 review; every case reproduced locally.
--
-- Every grant below is mapped from an actual .insert()/.upsert() call site in
-- src/ (actions/shoots, bids, reviews, disputes, reports, messages, favorites,
-- photographer, availability, core/invites). Server-owned columns (status,
-- created_at, accepted_bid_id, reply, resolved_*, ...) fall back to their
-- defaults or are set by SECURITY DEFINER functions and triggers, which do not
-- depend on these grants. insert_grants_hardening.test.sql enforces this
-- catalog-wide, and section 6 makes new tables start closed, so a future table
-- or column inherits no write privilege silently.

-- ── 1. Column-scoped INSERT for every table users write directly ────────
revoke insert on public.shoots from anon, authenticated;
grant insert (client_id, title, type, discipline, brief, location_city, location_postcode,
              canton, shoot_date, duration_hours, budget_min_chf, budget_max_chf)
  on public.shoots to authenticated;

revoke insert on public.bids from anon, authenticated;
grant insert (shoot_id, photographer_id, amount_chf, message) on public.bids to authenticated;

revoke insert on public.reviews from anon, authenticated;
grant insert (shoot_id, client_id, photographer_id, rating, comment) on public.reviews to authenticated;

revoke insert on public.disputes from anon, authenticated;
grant insert (shoot_id, opened_by, reason) on public.disputes to authenticated;

revoke insert on public.reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, category) on public.reports to authenticated;

revoke insert on public.messages from anon, authenticated;
grant insert (conversation_id, sender_id, body, image_path) on public.messages to authenticated;

revoke insert on public.favorites from anon, authenticated;
grant insert (user_id, photographer_id) on public.favorites to authenticated;

revoke insert on public.portfolio_images from anon, authenticated;
grant insert (photographer_id, storage_path) on public.portfolio_images to authenticated;

revoke insert on public.shoot_images from anon, authenticated;
grant insert (shoot_id, storage_path) on public.shoot_images to authenticated;

revoke insert on public.shoot_invitations from anon, authenticated;
grant insert (shoot_id, photographer_id, client_id) on public.shoot_invitations to authenticated;

revoke insert on public.user_blocks from anon, authenticated;
grant insert (blocker_id, blocked_id) on public.user_blocks to authenticated;

revoke insert on public.photographer_unavailable from anon, authenticated;
grant insert (photographer_id, date) on public.photographer_unavailable to authenticated;

-- ── 2. No direct INSERT at all ──────────────────────────────────────────
-- profiles rows come from handle_new_user(), conversations from
-- create_conversation_on_assign(), notifications from the notify_* triggers;
-- all are SECURITY DEFINER. None has an insert policy, so RLS already refused
-- these; the grant goes too so the privilege layer agrees.
revoke insert on public.profiles from anon, authenticated;
revoke insert on public.conversations from anon, authenticated;
revoke insert on public.notifications from anon, authenticated;

-- Read-only views: never written through.
revoke insert, update, delete on public.photographer_effective_tier from anon, authenticated;
revoke insert, update, delete on public.photographer_ratings from anon, authenticated;

-- ── 3. UPDATE where no update policy exists ─────────────────────────────
-- RLS already refuses these (no policy); admin changes go through the
-- service role. Removing the grant keeps privileges and policies in step.
revoke update on public.disputes from anon, authenticated;
revoke update on public.reports from anon, authenticated;
revoke update on public.messages from anon, authenticated;
revoke update on public.favorites from anon, authenticated;
revoke update on public.shoot_images from anon, authenticated;
revoke update on public.shoot_invitations from anon, authenticated;
revoke update on public.user_blocks from anon, authenticated;
revoke update on public.photographer_unavailable from anon, authenticated;

-- ── 4. profile_views: no raw reads ──────────────────────────────────────
-- The raw rows name every signed-in viewer. A free photographer could read
-- them directly, bypassing both the Premium gate and the privacy rule in
-- premium_profile_viewers() (only clients with an open shoot are named). The
-- app never selects this table; counts and the Premium list come from the
-- SECURITY DEFINER functions photographer_view_count() and
-- premium_profile_viewers().
revoke select on public.profile_views from anon, authenticated;
-- With no grant the owner-read policy is dead; drop it so a later re-grant
-- cannot quietly bring the viewer-identity leak back.
drop policy if exists "profile_views_select_own" on public.profile_views;

-- ── 5. DELETE where no delete policy exists ─────────────────────────────
-- Same reasoning as section 3: RLS already refuses these, so the privilege
-- goes too. The app deletes only favorites, photographer_unavailable,
-- portfolio_images, shoot_images and user_blocks, each of which keeps its
-- grant and its owner-only delete policy.
revoke delete on public.shoots, public.bids, public.reviews, public.disputes, public.reports,
  public.messages, public.shoot_invitations, public.profiles, public.conversations,
  public.notifications, public.photographer_details
  from anon, authenticated;

-- ── 6. New tables start closed ──────────────────────────────────────────
-- Supabase's default ACL hands anon/authenticated ALL on every table created
-- in public, which is how every hole closed here and in 20261008120000 came
-- about. Tables created by migrations (role postgres) now get no write
-- privilege by default; a migration adding a table must grant the columns
-- its server actions write, explicitly. SELECT stays default (RLS-gated).
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger, maintain on tables
  from anon, authenticated;
