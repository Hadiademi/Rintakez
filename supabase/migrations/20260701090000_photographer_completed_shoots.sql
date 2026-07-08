-- Public trust signal on the photographer profile: "N shoots completed".
--
-- shoots/bids are NOT publicly readable (shoots_select only allows the shoot's
-- own client or its accepted photographer — see 20260613005248_security.sql),
-- so a plain query or a security_invoker view would return 0 for every viewer
-- except the photographer themselves. Unlike photographer_ratings (a view over
-- the publicly-readable reviews table), this needs to cross RLS boundaries, so
-- it's a SECURITY DEFINER function like is_shoot_client/is_accepted_photographer
-- — it returns only an aggregate integer, never row-level shoot/bid data, so
-- bypassing RLS inside the function body is safe.
create or replace function public.photographer_completed_shoots_count(p_photographer_id uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int
  from shoots s
  join bids b on b.id = s.accepted_bid_id
  where s.status = 'completed' and b.photographer_id = p_photographer_id;
$$;

grant execute on function public.photographer_completed_shoots_count(uuid) to anon, authenticated;
