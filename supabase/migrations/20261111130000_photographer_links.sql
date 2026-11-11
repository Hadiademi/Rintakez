-- Photographer links: a labelled list instead of one website + one Instagram.
--
-- A founding photographer works in sport and in weddings and, like most
-- photographers in two fields, keeps a separate website and Instagram for
-- each. The profile had room for exactly one of each. `links` holds up to six
-- { url, label } entries; the label ("Sport", "Hochzeit") tells visitors which
-- is which. The app normalises what people type (src/lib/links.ts) — the CHECK
-- below is the backstop, because owners can write this column directly through
-- the API and the value is rendered as an href on a public page.
--
-- website_url / instagram_url stay. The app keeps writing them (the first
-- website and the first Instagram link, legacyLinkColumns()) so a rollback to
-- the previous release still shows a photographer's main links, and the app
-- reads them as a fallback while `links` is empty. They can be dropped in a
-- later migration once this release has settled.

-- ── shape check ──────────────────────────────────────────────────────
-- Immutable so it can back a CHECK constraint. Two details matter:
--  * It must return a strict true/false. A CHECK treats NULL as "passes", so a
--    NULL leaking out of a missing key would let a bad row through — hence the
--    coalesce() around every per-key test.
--  * SQL does not promise left-to-right evaluation of AND/OR, and
--    jsonb_array_elements / jsonb_object_keys RAISE on the wrong jsonb type.
--    CASE is the construct that does fix the order, so the type is checked
--    before anything that would throw on it.
create or replace function public.valid_photographer_links(p_links jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_links is null or jsonb_typeof(p_links) <> 'array' then false
    when jsonb_array_length(p_links) > 6 then false
    else not exists (
      select 1
      from jsonb_array_elements(p_links) as e(item)
      where case
        when jsonb_typeof(e.item) <> 'object' then true
        else
          -- only the two known keys
          exists (
            select 1 from jsonb_object_keys(e.item) as k(name)
            where k.name not in ('url', 'label')
          )
          -- url: an http(s) address with a dotted host, no whitespace, bounded
          or coalesce(jsonb_typeof(e.item -> 'url'), '') <> 'string'
          or coalesce((e.item ->> 'url') !~* '^https?://[^[:space:]/]+\.[^[:space:]]+$', true)
          or length(e.item ->> 'url') > 300
          -- label: absent, null or a short string
          or coalesce(jsonb_typeof(e.item -> 'label'), 'null') not in ('null', 'string')
          or length(coalesce(e.item ->> 'label', '')) > 40
      end
    )
  end;
$$;

alter table public.photographer_details
  add column links jsonb not null default '[]'::jsonb;

alter table public.photographer_details
  add constraint photographer_details_links_valid
  check (public.valid_photographer_links(links));

-- ── carry existing links over ────────────────────────────────────────
-- Only values that already pass the new check move; anything else stays in the
-- legacy column (and is dropped by the app's reader too) rather than failing
-- the migration on production data.
update public.photographer_details d
set links = coalesce(
  (
    select jsonb_agg(jsonb_build_object('url', v.url, 'label', null) order by v.ord)
    from (values (1, d.website_url), (2, d.instagram_url)) as v(ord, url)
    where v.url is not null
      and length(v.url) <= 300
      and v.url ~* '^https?://[^[:space:]/]+\.[^[:space:]]+$'
  ),
  '[]'::jsonb
)
where d.links = '[]'::jsonb
  and (d.website_url is not null or d.instagram_url is not null);

-- ── privileges (grants rule, CLAUDE.md) ──────────────────────────────
-- Public profile column: readable like the other profile columns
-- (20261013120000 made SELECT column-scoped, so a new column is unreadable
-- until granted). The owner writes it from onboarding and profile settings;
-- RLS (photographer_details_insert_own / _update_own) keeps that to their row.
grant select (links) on public.photographer_details to anon, authenticated;
grant insert (links), update (links) on public.photographer_details to authenticated;
