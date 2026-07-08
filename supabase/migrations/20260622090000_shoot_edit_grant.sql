-- Let clients edit their own OPEN shoot. The shoots UPDATE grant was scoped to
-- (status, cancellation_reason) in 20260622010000; extend it with the editable
-- detail columns. is_suspended / accepted_bid_id / client_id stay excluded, and
-- RLS (shoots_update_own) still scopes edits to the owner; the action restricts
-- editing to open shoots.
grant update (
  title, type, discipline, brief, location_city, location_postcode, canton,
  shoot_date, duration_hours, budget_min_chf, budget_max_chf
) on public.shoots to authenticated;
