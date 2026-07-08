-- New enum value for in-app shoot_match notifications (FIX 1). Split into its
-- own migration file: Postgres cannot use a value added by ALTER TYPE ... ADD
-- VALUE in the same transaction that added it, and Supabase runs each
-- migration file in its own transaction — so the function that references
-- 'shoot_match' must live in a later migration file (20260701060000).
alter type public.notification_type add value if not exists 'shoot_match';
