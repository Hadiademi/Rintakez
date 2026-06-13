# Rintakez Plan 6: Launch Runbook (Production Deployment)

**Status:** Requires the owner's accounts — execute together when Hadi is available.

This is a step-by-step runbook, not an autonomous plan. Every step that needs an account or a secret is marked **[OWNER]**. Claude can run the non-account steps and verify outputs.

The app (Plans 1–5, tag `v0.5.0-polish`) is feature-complete: auth, onboarding, the full client/photographer marketplace loop, public profiles, SEO, legal pages, dark mode, PWA, responsive mobile nav — all RLS-secured and covered by 38 unit tests, 28 pgTAP RLS assertions, and 10 Playwright E2E specs.

---

## 0. Pre-flight (no accounts needed) — Claude can do these

- [ ] Confirm the full matrix is green on `main`: `npm run lint && npm run typecheck && npx vitest run && npm run build`, then `npx supabase start && npx supabase test db`, then `npx supabase db reset && npm run test:e2e`.
- [ ] **Fill the legal placeholders** — Impressum + Datenschutz currently contain `[BITTE AUSFÜLLEN]` / `[À COMPLÉTER]` / `[TO COMPLETE]`. **[OWNER]** must provide: legal name/company, full address, contact email, data-protection contact email. Then edit `legal.impressumPlaceholder` and `legal.dsContactPlaceholder` in `src/i18n/messages/{de,fr,en}.json`.
- [ ] **Replace placeholder PWA icons** — `public/icon-192.png` / `public/icon-512.png` are solid-color placeholders. **[OWNER]** provides real brand icons (or approve the placeholders for launch).
- [ ] Decide the production domain (e.g. `rintakez.ch`). **[OWNER]**

## 1. GitHub **[OWNER]**

- [ ] Create a private repo `Hadiademi/Rintakez` (already created at https://github.com/Hadiademi/Rintakez.git).
- [ ] Authenticate git locally: `gh auth login` (install GitHub CLI) **or** add an SSH key to the GitHub account, then:
  ```bash
  git remote set-url origin git@github.com:Hadiademi/Rintakez.git   # SSH
  git push -u origin main --tags
  ```
- [ ] Confirm GitHub Actions runs the `app`, `db`, and `e2e` jobs green on the pushed `main`.

## 2. Supabase production project **[OWNER]**

- [ ] At supabase.com create project `rintakez-prod`, **region: Zürich (aws eu-central-2)**. Save the DB password in a password manager.
- [ ] Get an access token: `supabase login` (or set `SUPABASE_ACCESS_TOKEN`).
- [ ] Link and push the schema (migrations only — **never** the dev seed):
  ```bash
  npx supabase link --project-ref <project-ref>
  npx supabase db push
  ```
- [ ] In the Supabase dashboard, verify: 5 tables present, RLS enabled on each, the `accept_bid` / `decline_bid` / `get_counterparty_email` functions exist, the `avatars` + `portfolio` storage buckets exist (public).
- [ ] Auth settings: set **Site URL** to the production domain; add the production domain (and the Vercel preview domains) to **Redirect URLs**. Decide **email confirmations** — turn them **ON** for production (local has them off). The register flow already handles both (shows "check your email" when no session is returned).
- [ ] (Optional, deferred from the original design) Google OAuth: create Google OAuth credentials and add them in Supabase Auth → Providers if you want social login. The register/login pages are email/password today; Google is an additive enhancement.
- [ ] Regenerate the typed client from the real schema and commit: `npm run db:types` (now that you're logged in) — replaces the hand-authored `src/lib/supabase/database.types.ts`.

## 3. Vercel **[OWNER]**

- [ ] Import the GitHub repo at vercel.com. Framework auto-detects Next.js.
- [ ] Set Environment Variables (Production + Preview) from the Supabase project's API settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL` = `https://<your-domain>` (used by sitemap/robots/metadata)
- [ ] Project Settings → Functions region: `fra1` (Frankfurt, closest to the Zürich DB).
- [ ] Trigger a production deploy; open the URL and smoke-test: landing in /de /fr /en, register, login, post a shoot, bid, accept.

## 4. Domain **[OWNER]**

- [ ] Add the custom domain in Vercel; set the DNS records at the registrar (Vercel shows them). HTTPS is automatic.
- [ ] Update `NEXT_PUBLIC_SITE_URL` to the final domain and redeploy so sitemap/robots/canonical URLs are correct.
- [ ] Update Supabase Auth Site URL / Redirect URLs to the final domain.

## 5. Production hardening — Claude can help, some **[OWNER]**

- [ ] Lighthouse pass on the deployed site (mobile): aim perf ≥ 90, a11y ≥ 95, best-practices, SEO ≥ 95. Fix regressions (image sizes, font preloading).
- [ ] Verify `/robots.txt` and `/sitemap.xml` on production point at the real domain.
- [ ] Verify PWA installability on the deployed HTTPS site (Chrome → Install).
- [ ] Confirm RLS once more against prod with a throwaway test account: a photographer cannot see another's bids; emails only exchange after acceptance.
- [ ] Set up Supabase database backups (Pro plan: daily). **[OWNER]** confirm plan = Pro so the project never pauses.
- [ ] (Optional) Error monitoring (Sentry) and analytics (Vercel Analytics / Plausible).
- [ ] Seed the production DB with a few real photographers/shoots OR launch empty and onboard the first users manually. **[OWNER]**

## 6. Go-live checklist (final gate before announcing)

- [ ] Legal pages have real operator details (no placeholders).
- [ ] Email confirmations ON; password reset flow tested (add a reset page if needed — currently not built; track as v0.6).
- [ ] All env vars set in Vercel (prod + preview).
- [ ] Custom domain live with HTTPS; `NEXT_PUBLIC_SITE_URL` matches.
- [ ] Lighthouse mobile ≥ 90 perf; SEO green; installable.
- [ ] Backups enabled; Supabase on Pro (no auto-pause).
- [ ] CI green on `main`.

---

## Known follow-ups (post-launch backlog)

- **Payments / commission** — deferred by design; Stripe Connect (TWINT + CHF) attaches to the `bids`/`shoots` lifecycle without schema upheaval. Decide the business model first.
- **Password reset + email change** flows (not built in v0.5).
- **Ratings & reviews** (schema-anticipated: `shoots.status='completed'` is the trigger).
- **Real-time chat** (Supabase Realtime; `conversations`/`messages` tables to be added).
- **Notifications** (email on new bid/accept; push via the PWA).
- **Native apps** (Expo against the same Supabase backend).
- **SW navigation caching** — exclude authenticated routes (minor, from Plan 5 review).
- **`notFound()` → 404 status** for non-photographer profile ids (minor SEO, from Plan 5 review).
- **Google OAuth** sign-in (additive).
