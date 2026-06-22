-- Per-user email notification preferences (account settings).
-- Two categories that actually trigger email today: bid activity and shoot
-- updates. Respected at enqueue time in notifyEmail. Default on.
alter table public.profiles
  add column notify_bids boolean not null default true,
  add column notify_shoot_updates boolean not null default true;

-- Let users toggle their own preferences. The profiles UPDATE grant is
-- column-scoped (20260613100000_admin), so extend it with just these two
-- columns — is_admin / is_suspended / role stay out of reach.
grant update (notify_bids, notify_shoot_updates) on public.profiles to authenticated;
