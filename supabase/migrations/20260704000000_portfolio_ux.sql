-- Task S3.2: portfolio editor pro.
-- Photographers can reorder their portfolio (persisting sort_order) and attach
-- an optional caption per image (shown in the lightbox). portfolio_images had
-- only insert + delete grants, so we add a column-scoped UPDATE grant limited to
-- (sort_order, caption) and an owner-only UPDATE policy — mirroring the pattern
-- used for cover_path on photographer_details.

-- Optional caption; empty is disallowed (clear by setting NULL), capped at 280.
alter table public.portfolio_images
  add column caption text
    check (caption is null or char_length(caption) between 1 and 280);

-- Owners may edit only these two columns (never storage_path / photographer_id).
grant update (sort_order, caption) on public.portfolio_images to authenticated;

-- RLS: a photographer may update only their own rows.
create policy "portfolio_update_own" on public.portfolio_images
  for update
  using (photographer_id = auth.uid())
  with check (photographer_id = auth.uid());
