-- Dev seed. Users all have password "password123".
-- Shoot UUIDs use a0...0001x prefix to stay clear of test fixtures (10000000-...).
-- Seed shoots are OPEN so the dev landing page shows live marketplace content.
-- Count tests in rls.test.sql are scoped to fixture UUIDs (10000000-...) and
-- are unaffected by this seed data.

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lena@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Lena & Tobias K.","locale":"de"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vitra@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Vitra AG","locale":"de"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marko@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"photographer","display_name":"Marko Brunner","locale":"de"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'claire@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"photographer","display_name":"Claire Dubois","locale":"fr"}', now(), now());

update public.profiles set city = 'Zürich', canton = 'ZH'
  where id = 'a0000000-0000-0000-0000-000000000003';
update public.profiles set city = 'Lausanne', canton = 'VD'
  where id = 'a0000000-0000-0000-0000-000000000004';

insert into public.photographer_details
  (profile_id, specialties, coverage_cantons, hourly_rate_chf)
values
  ('a0000000-0000-0000-0000-000000000003',
   '{wedding,portrait}', '{ZH,ZG,SZ,VS}', 280),
  ('a0000000-0000-0000-0000-000000000004',
   '{commercial,architecture,portrait}', '{VD,GE,FR}', 320);

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
   'Zermatt', '3920', 'VS', '2026-08-14', 10, 3200, 4500),

  -- Open: Editorial Vitra Sommerkollektion
  ('a0000000-0000-0000-0001-000000000002',
   'a0000000-0000-0000-0000-000000000002',
   'Editorial — Vitra Sommerkollektion', 'commercial',
   'Indoor-Studio, klares Tageslicht, 12 Stühle, ein Sofa. Aesthetik wie der gedruckte Katalog 2024.',
   'Basel', '4051', 'BS', '2026-07-03', 6, 4800, 6200),

  -- Open: Porträtserie EPFL Forschungsteam
  ('a0000000-0000-0000-0001-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'Porträtserie für Forschungsteam', 'portrait',
   'EPFL Labor. 18 Personen, je 5–7 Minuten. Schwarzweiss bevorzugt.',
   'Lausanne', '1015', 'VD', '2026-07-21', 4, 1800, 2400),

  -- Will be assigned below (open first, then bid accepted)
  ('a0000000-0000-0000-0001-000000000004',
   'a0000000-0000-0000-0000-000000000002',
   'Produktfotografie Bürostuhl EVO', 'commercial',
   'Drei Farbvarianten des Stuhls, Weisshintergrund und Lifestyle-Setting im Showroom.',
   'Basel', '4058', 'BS', '2026-09-10', 5, 3500, 5000),

  -- Will be cancelled below
  ('a0000000-0000-0000-0001-000000000005',
   'a0000000-0000-0000-0000-000000000001',
   'Familienportrait Weihnachten', 'portrait',
   'Abgesagt — Termin nicht mehr aktuell.',
   'Bern', '3011', 'BE', '2026-12-22', 2, 800, 1200);

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
