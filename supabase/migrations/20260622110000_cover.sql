-- Photographer-controlled cover image for the public profile band. Stored in the
-- existing public 'portfolio' bucket under <uid>/cover/. The public profile uses
-- cover_path first, then falls back to the first portfolio image, then a band.
alter table public.photographer_details
  add column cover_path text;

-- Pros may set/clear their own cover (column-scoped grant, like disciplines).
grant update (cover_path) on public.photographer_details to authenticated;
