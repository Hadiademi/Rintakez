-- Videographer support. The professional ("photographer") role is really "the
-- creative who fulfils shoots"; the craft is an orthogonal dimension, so we add
-- a discipline (photo/video) rather than a third user_role. shoot_type stays the
-- occasion (wedding, portrait, …); discipline is the medium.

create type public.discipline as enum ('photo', 'video');

-- What a professional offers (one or both). Existing pros are photographers.
alter table public.photographer_details
  add column disciplines public.discipline[] not null default '{photo}';

-- cardinality() returns 0 for '{}' (array_length returns NULL, which a CHECK
-- treats as satisfied) so it correctly rejects an empty array.
alter table public.photographer_details
  add constraint disciplines_nonempty check (cardinality(disciplines) >= 1);

-- Pros may edit their own disciplines (column-scoped grant, like specialties).
grant update (disciplines) on public.photographer_details to authenticated;

-- What medium a shoot needs (single choice for now).
alter table public.shoots
  add column discipline public.discipline not null default 'photo';
