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

## Launch status (as of 2026-10-08)

Done & live: Resend verified + Supabase SMTP (noreply@framly.ch), root SPF,
Upstash rate limiting, Google OAuth, **Stripe LIVE** (keys/prices/webhook in
Vercel env, live billing portal with plan switching), Discord error alerts +
UptimeRobot, CI (gates + audit + pgTAP job).

Still open (people, not code): DMARC record `_dmarc` (friend/Hostpoint),
Google OAuth "Publish App" (friend), Stripe dashboard Branding (client), 2FA on
GitHub/Vercel/Supabase/Google (owner + friend). Founding photographers hold
`admin_comp` premium until 2027-01-07/08 — they drop to Free silently on
expiry; plan an outreach/reminder before then.

**Grants rule (learned 2026-10-08):** Supabase's default ACL grants ALL on
every new public table to anon/authenticated. A column-scoped grant is moot
while the table-level grant exists — every migration that adds a table must
`revoke` what it doesn't want granted. `grants_hardening.test.sql` enforces
the catalog-wide invariants (no anon writes, no TRUNCATE).

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
