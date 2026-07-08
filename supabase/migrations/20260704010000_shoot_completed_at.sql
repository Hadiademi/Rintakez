-- Batch S3.6 — record when a shoot is actually completed.
--
-- The review-request lifecycle scan (src/lib/lifecycle.ts scanReviewRequest)
-- measured its "completed N days ago, still no review" window off created_at as
-- a documented proxy, because shoots had no completion timestamp. Add a real
-- completed_at column and stamp it in complete_shoot so the window is measured
-- from actual completion. Pre-existing completed shoots keep a NULL
-- completed_at (a one-time gap); the scan filters them out rather than paging
-- them forever.
alter table public.shoots add column completed_at timestamptz;

-- Re-create complete_shoot IDENTICALLY (ownership + status + premature-completion
-- date guard all unchanged) but also stamp completed_at = now() in the UPDATE.
create or replace function public.complete_shoot(p_shoot_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update shoots set status = 'completed', completed_at = now()
  where id = p_shoot_id
    and client_id = auth.uid()
    and status = 'assigned'
    and shoot_date <= current_date;
  if not found then
    raise exception 'cannot complete shoot' using errcode = 'P0001';
  end if;
end;
$$;
