# Framly — Deploy Runbook (Supabase + Vercel)

Launch candidate: `main` @ `9546353` — all gates green (typecheck, lint, vitest 330,
pgTAP 295, e2e 20/20, build, i18n 834×3, check:legal). Everything below is
**configuration**, not code. Follow the phases in order — later phases depend on
earlier ones.

Cost when done: Vercel Pro ~$20 + Supabase Pro ~$25 ≈ **CHF 40/month** + Stripe %.

---

## Phase 0 — Push the code to GitHub (5 min)

Vercel deploys from git; the repo is currently local-only.

```bash
gh auth switch --hostname github.com --user Hadiademi   # hadiademi1 has no write access
git push origin main
gh auth switch --hostname github.com --user hadiademi1  # switch back if you prefer
```

Optional: rename the GitHub repo Rintakez → Framly (Settings → General → Rename).
The remote URL updates automatically; local git keeps working via redirect.

## Phase 1 — Supabase production project (~30 min)

1. **Create the project:** supabase.com → New project → org of the owner →
   name `framly-prod` → **Region: Zurich (eu-central-2)** ← data residency, do not
   pick Frankfurt → generate a STRONG database password and save it in a
   password manager.
2. **Upgrade to Pro** ($25/mo): daily backups, no auto-pausing, higher limits.
3. **Collect the keys** (Project Settings → API):
   - Project URL → will become `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (⚠ secret, server-only) → `SUPABASE_SERVICE_ROLE_KEY`
4. **Apply the migrations** from your machine (this pushes ONLY migrations —
   `db push` never runs seed.sql, which contains dev users/passwords and must
   never reach prod):

```bash
cd rintakez-v2-4
npx supabase login                       # one-time browser auth
npx supabase link --project-ref <REF>    # REF = the id in the project URL
npx supabase db push                     # applies supabase/migrations/*
```

5. **Verify** in Dashboard → Table editor: tables exist (profiles, shoots, bids,
   conversations, subscriptions, …) and Storage → buckets exist (avatars,
   portfolio, message-images — they are created by migrations).
6. **Auth hardening** (Dashboard — the local config.toml does NOT apply to prod):
   - Authentication → Sign In / Up → Email: **Confirm email = ON**
   - Authentication → Sign In / Up: **Minimum password length = 8**
   - Authentication → URL Configuration:
     - Site URL: `https://framly.ch`
     - Redirect URLs: `https://framly.ch/**` (add your `*.vercel.app` preview
       domain too if you want auth on previews)
   - Authentication → Emails → SMTP: set **Resend SMTP** once Phase 3 is done
     (host `smtp.resend.com`, user `resend`, password = the API key, from
     `noreply@framly.ch`). Without custom SMTP, Supabase's built-in mailer is
     rate-limited to a handful of emails per hour — fine for a smoke test,
     not for real signups.
   - Authentication → Emails → Templates: replace any default/project wording
     with Framly.
7. **Create the real admin** (after the first deploy, Phase 5): register
   normally in the app with the owner's email, then Dashboard → SQL editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'admin@framly.ch');
```

## Phase 2 — Stripe (test mode now, live later) (~20 min)

1. In the **test-mode** dashboard: Products → create the three paid plans
   (Basic CHF 59, Standard CHF 119, Premium CHF 229, monthly, CHF). Copy the
   three price IDs (`price_…`). Yearly prices are optional — the code treats
   missing yearly env vars as "not offered".
2. Statement descriptor (Settings → Public details): `FRAMLY` — matters at
   live activation; harmless to set now.
3. The **webhook endpoint needs the live domain**, so it happens in Phase 6.
4. Going live later (the client's account — money and KYC are theirs): recreate
   the 3 prices there, swap the env keys. It is a 6-env-var change, nothing else.

## Phase 3 — Resend (email) (~15 min + DNS propagation)

1. resend.com → Domains → Add `framly.ch`.
2. Add the SPF + DKIM DNS records it shows you at the framly.ch registrar.
   Wait for "Verified" (minutes to hours).
3. Create an API key → `RESEND_API_KEY`.
4. Sender will be `Framly <noreply@framly.ch>` → `EMAIL_FROM`.
5. Wire the same credentials into Supabase Auth SMTP (Phase 1 step 6).

## Phase 4 — Upstash Redis (rate limiting) (~5 min)

Without it, rate limiting is per-serverless-instance (near-useless under load).

1. upstash.com → Redis → Create database → region **eu-central-1 (Frankfurt)**.
2. Copy the REST URL + REST token → `UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`.

## Phase 5 — Vercel (~30 min)

1. **Project:** vercel.com → the existing project `rintakez-v2-4` is already
   linked (`.vercel/project.json`). Either rename it to `framly`
   (Settings → General) or import fresh from the GitHub repo. Connect it to
   the GitHub repo either way → every push to `main` auto-deploys.
2. **Upgrade to Pro** — the `*/5 * * * *` cron in vercel.json requires it
   (Hobby allows one daily cron only).
3. **Function region:** Settings → Functions → `fra1` (Frankfurt) — closest to
   Supabase Zürich.
4. **Environment variables** (Settings → Environment Variables, target
   **Production**; set BEFORE deploying — the CSP and sitemap read them at build):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Phase 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Phase 1 (secret) |
| `NEXT_PUBLIC_SITE_URL` | `https://framly.ch` |
| `RESEND_API_KEY` | from Phase 3 |
| `EMAIL_FROM` | `Framly <noreply@framly.ch>` |
| `CRON_SECRET` | `openssl rand -hex 32` — Vercel automatically sends it as the Bearer token to the cron route |
| `UPSTASH_REDIS_REST_URL` | from Phase 4 |
| `UPSTASH_REDIS_REST_TOKEN` | from Phase 4 |
| `STRIPE_SECRET_KEY` | test-mode `sk_test_…` for now |
| `STRIPE_PRICE_BASIC_MONTHLY` | from Phase 2 |
| `STRIPE_PRICE_STANDARD_MONTHLY` | from Phase 2 |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | from Phase 2 |
| `STRIPE_WEBHOOK_SECRET` | set in Phase 6 (needs the live URL) |

   Skip for launch (gated features stay off): Google OAuth vars, Plausible,
   `ERROR_WEBHOOK_URL` (add one later — a Slack/Discord webhook works).
5. **Deploy:** `git push` (auto) or `npx vercel --prod`.
6. **Domain:** Project → Settings → Domains → add `framly.ch` (+ `www.framly.ch`
   redirecting to apex). At the registrar, set the A/CNAME records Vercel shows.
   SSL is automatic.

## Phase 6 — Stripe webhook (after the domain is live) (~10 min)

1. Stripe (test mode) → Developers → Webhooks → Add endpoint:
   `https://framly.ch/api/stripe/webhook`
2. Events: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
3. Copy the signing secret → set `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy
   (env changes need a redeploy).

## Phase 7 — Live smoke test (the launch gate) (~30 min)

Walk the real flows on https://framly.ch:

- [ ] `/api/health` returns ok; `/sitemap.xml` and `/robots.txt` render with framly.ch URLs
- [ ] Register a client → **confirmation email arrives** (Resend) → confirm → login
- [ ] Register a photographer (second mailbox) → onboarding → portfolio upload (storage works)
- [ ] Client posts a shoot → photographer sees it in browse → bids
- [ ] Client accepts the bid → contact reveal → messages flow **in realtime** (two browsers)
- [ ] `/pricing` → subscribe with test card `4242 4242 4242 4242` → plan activates
      (webhook worked) → Customer Portal opens
- [ ] Admin account (Phase 1 step 7) reaches `/admin`; a non-admin gets redirected
- [ ] PWA: install prompt on mobile shows the **Framly "F"** icon
- [ ] de / fr / en all render; OG preview (paste a link into WhatsApp/Slack) shows
      the Framly card — dynamic OG was environment-flaky locally, verify it here
- [ ] Cron: Vercel → Logs → confirm `/api/cron/process` runs every 5 min with 200
      (not 401/503 — if so, CRON_SECRET is wrong/missing)

## Rollback

Vercel keeps every deployment — Promote a previous deployment to production in
one click. DB migrations are forward-only; Supabase Pro has daily backups +
point-in-time recovery.

## Later (non-blocking)

- Live Stripe on the client's account (KYC, bank) → swap 6 env vars
- `ERROR_WEBHOOK_URL` → Slack/Discord for captureError alerts. Setup (5 min):
  1. Discord → your server → channel `#framly-alarms` → ⚙️ → Integrations →
     Webhooks → New Webhook → Copy URL (`https://discord.com/api/webhooks/…`).
  2. Vercel → framly → Settings → Environment Variables → add
     `ERROR_WEBHOOK_URL` = that URL (Production) → redeploy.
  3. Test: `curl -X POST "$URL" -H 'Content-Type: application/json' -d '{"content":"test"}'`
     should post "test" in the channel.
  The sink body auto-adapts (`src/lib/observability.ts`): Discord `{content}`,
  Slack `{text}`, anything else raw JSON. Posts are throttled to 5/min per
  instance so an error storm can't flood the channel; the full stream is always
  in Vercel logs.
- External uptime ping (5 min, free): UptimeRobot → New Monitor → HTTP(s) →
  `https://framly.ch/api/health`, interval 5 min, alert on non-200. The health
  route returns 503 when Supabase is unreachable, so this catches both a dead
  deploy AND a broken database from OUTSIDE our infra (a Vercel-wide outage
  can't alert itself).
- Plausible analytics (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`)
- Google OAuth (client id + secret, Supabase provider config)
- Rename Vercel/GitHub projects to Framly if not done in Phases 0/5
