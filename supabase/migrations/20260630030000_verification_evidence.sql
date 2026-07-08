-- Make the verification badge mean something. Previously a photographer could
-- self-request verification with no payload at all and an admin approved blind,
-- so '✓ Verified' certified nothing. Collect an evidence note at request time
-- (links to ID / business registration / portfolio proof) which the admin
-- reviews before deciding. The column is owner-writable (column-scoped grant +
-- existing own-row RLS); verification_status itself stays out of reach.

alter table public.photographer_details
  add column if not exists verification_note text;

grant update (verification_note) on public.photographer_details to authenticated;
