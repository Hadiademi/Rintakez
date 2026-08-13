# Framly (formerly Rintakez)

Two-sided Swiss photo/video marketplace: client posts a shoot → photographers
bid → client accepts → contact exchange. Revenue: photographer subscriptions
(Free/Basic/Standard/Premium, CHF 0/59/119/229, bid quotas 1/5/32/∞), web-only
Stripe (never in-app). Owner: Hadi Ademi. Legal entity (Impressum) is
"Rinor Mustafi – Rintakez", Einzelfirma, UID CHE-466.681.384 — **Framly is a
trade name; NEVER rename the registered identity in `legal.impressumOperatorBody`.**

Stack: Next.js 16 App Router (RSC, Server Actions, TS) · Supabase (Postgres/
Auth/Storage/Realtime, RLS is the security boundary) · Tailwind v4 · next-intl
(de/fr/en — **key parity across all three is a hard gate**) · Stripe · Vitest +
pgTAP + Playwright.

## Production (LIVE since 2026-08-13)

- **https://framly.ch** — live, SSL, www→apex. Vercel project **`framly`**
  (team hadiademis-projects, Pro), auto-deploys on push to `main` of
  github.com/Hadiademi/Rintakez. Region fra1. Cron `*/5` via vercel.json.
- **Supabase prod:** project `framly-prod`, ref `grkqvvsovfxbvnddrlxz`,
  **Zürich (eu-central-2)**, Pro plan, Micro compute. All migrations pushed via
  `npx supabase db push` (repo is `supabase link`ed to PROD — db push hits prod;
  local db:reset/test unaffected). **seed.sql must NEVER reach prod.**
- Prod admin: `admin@framly.ch` (is_admin). Passwords/keys live ONLY in local
  files: `~/framly-prod-db-password.txt`, `~/framly-admin-password.txt`,
  `~/framly-cron-secret.txt`, `~/framly-resend-key.txt`. Anon/service API keys:
  re-fetch anytime with `npx supabase projects api-keys --project-ref grkqvvsovfxbvnddrlxz`.
- Auth hardening applied via Management API (token in macOS keychain
  "Supabase CLI"): confirm-email ON, min pw 8, site_url https://framly.ch.
- Email split: **Google Workspace** = human mailboxes (info@, admin@…, MX).
  **Resend** = app transactional mail (subdomain send.framly.ch; does not touch
  Google's MX). info@framly.ch is the legal contact on Impressum/Datenschutz.

## Launch checklist — REMAINING (as of 2026-08-13)

1. **Resend verification** — DNS records confirmed live (dig ✓), Resend status
   was `pending` (crawler lag). Next session: check status, then wire Supabase
   SMTP (steps + exact curl in auto-memory `rintakez-project.md`). Until then
   auth emails use Supabase's built-in mailer (~2-4/hour, works but limited).
2. **Root SPF fix (friend/Hostpoint):** `framly.ch TXT` still
   `v=spf1 redirect=spf.mail.hostpoint.ch` → must become
   `v=spf1 include:_spf.google.com ~all` (else Google-sent mail risks spam).
3. **Upstash Redis** (user creates, free, eu-central-1) → set
   `UPSTASH_REDIS_REST_URL/TOKEN` in Vercel env; without it rate limiting is
   per-instance only.
4. **Stripe (LIVE mode, client's account):** waiting from the client:
   `whsec_…` (webhook → https://framly.ch/api/stripe/webhook with exactly:
   checkout.session.completed, customer.subscription.created/updated/deleted,
   invoice.paid, invoice.payment_failed) + `sk_live_…` + 3 price IDs
   (Basic CHF 59 / Standard 119 / Premium 229, monthly). Then set
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*_MONTHLY` in
   Vercel + redeploy. pk_ keys are unused (server-side Hosted Checkout only).
   Live E2E: comp the client's account or real-subscribe + refund (4242 won't
   work in live mode).

## Working conventions (bite hard if ignored)

- **Gates before "done":** typecheck · lint (0 errors) · vitest · db:test ·
  build · i18n parity de/fr/en. Run `npm run db:reset` before `db:test` when a
  new migration exists — `supabase test db` does NOT apply migrations.
- Local test accounts vanish on db:reset → `node scripts/seed-test-accounts.mjs`
  (klient@test.ch / fotograf@test.ch, pw test1234, fotograf is_admin). e2e uses
  seed.sql's `admin@framly.ch` (survives reset).
- **Port 3000 is often taken by the user's OTHER projects** (Dockix, Open
  WebUI). Playwright's `reuseExistingServer` then silently tests the WRONG app
  (all tests time out at login). Verify `curl -s localhost:3000 | grep title`
  first; for e2e use a temp config on a verified-free port (3200 worked).
- Local auth rate limit: `sign_in_sign_ups = 30` per **5 minutes** — repeated
  e2e runs fail all logins with "Limit erreicht."; wait ~5 min, never "fix" it
  in code.
- Internal identifiers deliberately still say rintakez (GUC
  `rintakez.reopen_orphan`, localStorage `rintakez:shoot-draft:`, ICS UID,
  supabase project_id local) — renaming = risk for zero user benefit. Leave.
- Shoot cards show the shoot's own uploaded photo (signed URL via
  `src/lib/shoot-cover.ts`), stock art (`shoot-image.ts`) only as fallback.
- Plan/tier source of truth: `photographer_effective_tier` view. MRR-style
  logic must exclude `source='admin_comp'`.
- Mobile parity: every UI change works at 390px. Billing stays web-only.
- gh active account must be **Hadiademi** (repo owner; hadiademi1 has no write).

## History / deep context

Full session-by-session state: auto-memory `rintakez-project.md` (this
machine). SDD ledger: `.superpowers/sdd/progress.md`. Deploy runbook:
`docs/framly-deploy-runbook.md`. Owner actions: `docs/framly-rebrand-owner-actions.md`.
