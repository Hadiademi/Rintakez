-- Dev seed. Users all have password "password123".
-- Shoot UUIDs use a0...0001x prefix to stay clear of test fixtures (10000000-...).
-- Seed shoots are OPEN so the dev landing page shows live marketplace content.
-- Count tests in rls.test.sql are scoped to fixture UUIDs (10000000-...) and
-- are unaffected by this seed data.

-- Token columns are set to '' (not NULL): newer GoTrue scans them as non-null
-- strings during password sign-in, so NULLs cause "Database error querying
-- schema". Each user also needs a matching row in auth.identities for the
-- email provider, otherwise sign-in fails.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change,
                        email_change_token_new, email_change_token_current)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lena@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Lena & Tobias K.","locale":"de"}', now(), now(),
   '', '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vitra@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Vitra AG","locale":"de"}', now(), now(),
   '', '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marko@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"photographer","display_name":"Marko Brunner","locale":"de"}', now(), now(),
   '', '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'claire@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"photographer","display_name":"Claire Dubois","locale":"fr"}', now(), now(),
   '', '', '', '', ''),
  -- Dedicated platform admin for oversight (is_admin set below). Strong initial
  -- password; change it after first login (a `db reset` reverts it to this).
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'admin@framly.ch',
   extensions.crypt('gzOuYKoDplFbJWNqtdJyAa1!', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Platform Admin","locale":"en"}', now(), now(),
   '', '', '', '', '');

-- Identities for the email provider (required for password sign-in).
insert into auth.identities (id, user_id, provider_id, provider, identity_data,
                             last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.id in (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005'
);

-- Grant the dedicated admin account oversight access.
update public.profiles set is_admin = true
  where id = 'a0000000-0000-0000-0000-000000000005';

update public.profiles set city = 'Zürich', canton = 'ZH'
  where id = 'a0000000-0000-0000-0000-000000000003';
update public.profiles set city = 'Lausanne', canton = 'VD'
  where id = 'a0000000-0000-0000-0000-000000000004';

insert into public.photographer_details
  (profile_id, specialties, coverage_cantons, hourly_rate_chf, verification_status,
   disciplines)
values
  ('a0000000-0000-0000-0000-000000000003',
   '{wedding,portrait}', '{ZH,ZG,SZ,VS}', 280, 'verified', '{photo}'),
  ('a0000000-0000-0000-0000-000000000004',
   '{commercial,architecture,portrait}', '{VD,GE,FR}', 320, 'verified',
   '{photo,video}');

-- Grant both seed photographers a 1-year standard comp so local dev has
-- entitled photographers (fixes P1's local free-cap-tripping). The
-- photographer_details rows already exist above, so update explicitly — the
-- P0 seed trigger only fires on INSERT.
insert into public.subscriptions (user_id, plan, status, source, comp_until, granted_by, note)
values
  ('a0000000-0000-0000-0000-000000000003','standard','comp','admin_comp', now() + interval '1 year', 'a0000000-0000-0000-0000-000000000005', 'Founding photographer comp'),
  ('a0000000-0000-0000-0000-000000000004','standard','comp','admin_comp', now() + interval '1 year', 'a0000000-0000-0000-0000-000000000005', 'Founding photographer comp');
update public.photographer_details
  set plan_tier = 'standard', plan_expires_at = now() + interval '1 year'
  where profile_id in ('a0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000004');

-- ── Shoots: 3 open + 1 assigned + 1 cancelled ────────────────────────────────
-- All inserted as 'open' (default); assigned/cancelled updated below via valid FSM path.
insert into public.shoots
  (id, client_id, title, type, brief, location_city, location_postcode, canton,
   shoot_date, duration_hours, budget_min_chf, budget_max_chf)
values
  -- Open: Hochzeit in Zermatt
  ('a0000000-0000-0000-0001-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Hochzeit in Zermatt', 'wedding',
   'Trauung um 14:30 in der Bergkapelle, anschliessend Apéro auf der Terrasse mit Matterhorn-Blick. Dokumentarischer Stil — ehrlich, ruhig.',
   'Zermatt', '3920', 'VS', (current_date + 10), 10, 3200, 4500),

  -- Open: Editorial Vitra Sommerkollektion
  ('a0000000-0000-0000-0001-000000000002',
   'a0000000-0000-0000-0000-000000000002',
   'Editorial — Vitra Sommerkollektion', 'commercial',
   'Indoor-Studio, klares Tageslicht, 12 Stühle, ein Sofa. Aesthetik wie der gedruckte Katalog 2024.',
   'Basel', '4051', 'BS', (current_date + 20), 6, 4800, 6200),

  -- Open: Porträtserie EPFL Forschungsteam
  ('a0000000-0000-0000-0001-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'Porträtserie für Forschungsteam', 'portrait',
   'EPFL Labor. 18 Personen, je 5–7 Minuten. Schwarzweiss bevorzugt.',
   'Lausanne', '1015', 'VD', (current_date + 30), 4, 1800, 2400),

  -- Will be assigned below (open first, then bid accepted)
  ('a0000000-0000-0000-0001-000000000004',
   'a0000000-0000-0000-0000-000000000002',
   'Produktfotografie Bürostuhl EVO', 'commercial',
   'Drei Farbvarianten des Stuhls, Weisshintergrund und Lifestyle-Setting im Showroom.',
   'Basel', '4058', 'BS', (current_date + 50), 5, 3500, 5000),

  -- Will be cancelled below
  ('a0000000-0000-0000-0001-000000000005',
   'a0000000-0000-0000-0000-000000000001',
   'Familienportrait Weihnachten', 'portrait',
   'Abgesagt — Termin nicht mehr aktuell.',
   'Bern', '3011', 'BE', (current_date + 120), 2, 800, 1200);

-- ── Bids on the open shoots ───────────────────────────────────────────────────
insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  -- Marko bids on Hochzeit in Zermatt
  ('a0000000-0000-0000-0002-000000000001',
   'a0000000-0000-0000-0001-000000000001',
   'a0000000-0000-0000-0000-000000000003', 3800,
   'Dokumentarischer Stil ist genau mein Ansatz — ruhig, unaufdringlich, ehrlich.'),

  -- Claire bids on Vitra Editorial
  ('a0000000-0000-0000-0002-000000000002',
   'a0000000-0000-0000-0001-000000000002',
   'a0000000-0000-0000-0000-000000000004', 5600,
   'Je travaille régulièrement pour des marques de mobilier — lumière naturelle maîtrisée.'),

  -- Marko also bids on the Produktfotografie shoot (which will become assigned)
  ('a0000000-0000-0000-0002-000000000003',
   'a0000000-0000-0000-0001-000000000004',
   'a0000000-0000-0000-0000-000000000003', 4200,
   'Studio-Produktfotografie ist eine meiner Kernkompetenzen.');

-- ── Accept Marko's bid on Produktfotografie → shoot becomes assigned ──────────
-- Valid FSM path: open → assigned (via accepted_bid_id set together with status).
-- Running as postgres (seed context) bypasses RLS; status trigger allows open→assigned.
update public.bids set status = 'accepted'
  where id = 'a0000000-0000-0000-0002-000000000003';

update public.shoots
  set status = 'assigned', accepted_bid_id = 'a0000000-0000-0000-0002-000000000003'
  where id = 'a0000000-0000-0000-0001-000000000004';

-- ── Cancel the Familienportrait shoot ─────────────────────────────────────────
update public.shoots set status = 'cancelled'
  where id = 'a0000000-0000-0000-0001-000000000005';

-- ── Past, completed shoots with reviews ───────────────────────────────────────
-- So the demo photographers have real ratings + bios instead of looking like
-- brand-new, empty, "verified" accounts (which read as fake on a fresh deploy).
insert into public.shoots
  (id, client_id, title, type, brief, location_city, location_postcode, canton,
   shoot_date, duration_hours, budget_min_chf, budget_max_chf)
values
  ('a0000000-0000-0000-0001-000000000006',
   'a0000000-0000-0000-0000-000000000001',
   'Standesamtliche Trauung Zürich', 'wedding',
   'Kleine Zeremonie im Stadthaus, danach Apéro am Wasser. Reportage-Stil.',
   'Zürich', '8001', 'ZH', (current_date - 60), 5, 1800, 2600),
  ('a0000000-0000-0000-0001-000000000007',
   'a0000000-0000-0000-0000-000000000002',
   'Markenshooting Designstudio', 'commercial',
   'Porträts des Teams und Produktdetails fürs Rebranding. Helle Bildsprache.',
   'Genève', '1201', 'GE', (current_date - 45), 6, 3200, 4200);

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('a0000000-0000-0000-0002-000000000004',
   'a0000000-0000-0000-0001-000000000006',
   'a0000000-0000-0000-0000-000000000003', 2200,
   'Reportage ist mein Zuhause — ich halte mich im Hintergrund.'),
  ('a0000000-0000-0000-0002-000000000005',
   'a0000000-0000-0000-0001-000000000007',
   'a0000000-0000-0000-0000-000000000004', 3800,
   'Branding-Shootings sind mein Schwerpunkt — konsistente, helle Bildsprache.');

update public.bids set status = 'accepted'
  where id in ('a0000000-0000-0000-0002-000000000004',
               'a0000000-0000-0000-0002-000000000005');

update public.shoots
  set status = 'assigned', accepted_bid_id = 'a0000000-0000-0000-0002-000000000004'
  where id = 'a0000000-0000-0000-0001-000000000006';
update public.shoots
  set status = 'assigned', accepted_bid_id = 'a0000000-0000-0000-0002-000000000005'
  where id = 'a0000000-0000-0000-0001-000000000007';

update public.shoots set status = 'completed'
  where id in ('a0000000-0000-0000-0001-000000000006',
               'a0000000-0000-0000-0001-000000000007');

insert into public.reviews (id, shoot_id, client_id, photographer_id, rating, comment)
values
  ('a0000000-0000-0000-0003-000000000001',
   'a0000000-0000-0000-0001-000000000006',
   'a0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000003', 5,
   'Marko war ruhig, präzise und einfühlsam. Die Bilder sind ehrlich und schön.'),
  ('a0000000-0000-0000-0003-000000000002',
   'a0000000-0000-0000-0001-000000000007',
   'a0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000004', 5,
   'Claire a parfaitement saisi notre identité de marque. Travail rapide et lumineux.');

-- Bios + verification evidence so the demo profiles aren't bare.
update public.profiles
  set bio = 'Dokumentarische Hochzeits- und Porträtfotografie aus Zürich. Ruhig, ehrlich, nah.'
  where id = 'a0000000-0000-0000-0000-000000000003';
update public.profiles
  set bio = 'Photographe commerciale et architecturale à Lausanne. Lumière naturelle, lignes nettes.'
  where id = 'a0000000-0000-0000-0000-000000000004';
update public.photographer_details
  set verification_note = 'Website: markostudio.ch · Handelsregister CHE-123.456.789'
  where profile_id = 'a0000000-0000-0000-0000-000000000003';
update public.photographer_details
  set verification_note = 'Portfolio: claire-photo.ch · IDE CHE-987.654.321'
  where profile_id = 'a0000000-0000-0000-0000-000000000004';
