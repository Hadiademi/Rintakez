-- M1: shoot reference images must not be world-readable.
-- The parent shoot is RLS-protected (only open shoots, the owner, or the
-- accepted photographer can see it), but the images lived in a PUBLIC bucket,
-- so anyone with the URL could read them. Make the bucket private and gate
-- object reads with a policy that mirrors `shoots_select`. Reads now require a
-- signed URL minted by a user who is allowed to see the shoot.

update storage.buckets set public = false where id = 'shoot-refs';

-- SELECT policy: a shoot-ref object is readable only by users who can see its
-- parent shoot. `name` (unqualified) correlates to storage.objects.name; the
-- joined tables have no `name` column, so there is no ambiguity.
drop policy if exists "storage_select_shootrefs_visible" on storage.objects;

create policy "storage_select_shootrefs_visible" on storage.objects
  for select using (
    bucket_id = 'shoot-refs'
    and exists (
      select 1
      from public.shoot_images si
      join public.shoots s on s.id = si.shoot_id
      where si.storage_path = name
        and (
          s.status = 'open'
          or s.client_id = auth.uid()
          or public.is_accepted_photographer(s.id)
        )
    )
  );
