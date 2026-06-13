# Rintakez — Production Roadmap

Senior engineering roadmap to take Rintakez from a working MVP to a
production-ready Swiss photography marketplace. Tasks are ordered by necessity.

**Working agreement**
- Each task ships with: migration (if needed) + hand-updated `database.types.ts`,
  RLS policies + **pgTAP RLS tests**, server actions, UI in the Atelier style,
  `de/fr/en` message keys, and verification (`typecheck`, `eslint`, `vitest`,
  `supabase test db`).
- Features needing external credentials (Stripe, Sentry, Resend, Google) are
  built **gated** — fully implemented but inert until keys are set. Never claim
  an untestable path "works".
- Never fabricate legal identity (Impressum operator name/address) — those stay
  as marked required fields for the owner to complete.

Status legend: ⬜ todo · 🟦 in progress · ✅ done · 🔒 gated (needs owner creds)

---

## Revenue model (strategic — needs owner decision)
- **#1 Monetization + anti-disintermediation.** The platform connects users then
  reveals contact; without a revenue mechanism and a reason to stay on-platform
  it earns nothing. Recommended: **Stripe Connect** commission on bookings
  (escrow), built behind `STRIPE_*` env (gated). Decision required: commission %
  vs photographer subscription vs lead fees. — 🔒

## Tier 0 — Launch blockers ✅
- **T0.1 Password reset** — forgot/reset pages via Supabase recovery + Mailpit;
  verified E2E. — ✅
- **T0.2 Legal pages** — AGB/ToS page (10 sections, de/fr/en) + footer link;
  Impressum/Datenschutz operator identity stays a marked placeholder. — ✅
- **T0.3 Account deletion** — `deleteAccount` (admin client, cascades + storage
  cleanup) + confirm UI; verified (0 rows after delete). — ✅
- **T0.4 ToS acceptance at signup** — required checkbox + Google consent line;
  schema-enforced; verified. — ✅

## Tier 1 — Core marketplace
- **T1.1 Photographer directory & search** — `/photographers` app page with
  specialty/canton/rating/price filters + sort; verified. — ✅
- **T1.2 In-app messaging** — conversations + messages, RLS, auto-open on
  assignment, realtime thread + list + read markers; verified two-way live. — ✅
- **T1.3 Booking & cancellation** — cancellation reason + policy note; notifies
  the assigned photographer (`shoot_cancelled`); reason shown on detail. Deposit
  hook deferred to payments (#1). — ✅

## Tier 2 — Production hardening ✅
- **T2.1 Error monitoring + analytics** — `captureError` seam + error/global-error
  boundaries + `onRequestError` instrumentation; gated Plausible analytics
  (privacy-first) + gated error webhook. — ✅
- **T2.2 Rate limiting** — in-process sliding-window limiter on bid/message/
  shoot/review/report actions. — ✅
- **T2.3 Moderation & reporting** — `reports` table + RLS (file own / private);
  report button on profiles & shoots; admin review via service role (T3.2). — ✅

## Tier 3 — Growth
- **T3.1 SEO** — sitemap (static + photographer profiles + /agb), tightened
  robots, JSON-LD Person schema (with aggregateRating) on photographer profiles.
  Dynamic OG images dropped: `next/og` ImageResponse crashes in this
  environment (even static) — revisit with a working runtime. — ✅
- **T3.2 Admin panel** — `is_admin` flag (column-protected, can't self-grant);
  `/admin` with metrics + open-reports review (reviewed/dismiss) via service
  role; admin-only nav link. Fixed service_role grants on migration tables. — ✅
- **T3.3 Availability + favorites** — `favorites` (client saved photographers,
  save button + "saved only" directory filter) + `photographer_unavailable`
  (block dates in profile, shown on public profile). RLS-tested; verified. — ✅

---

## Progress log
All tiers (T0–T3) landed on `feat/production-roadmap` across 6 commits, each
verified: typecheck ✓, eslint ✓, 39 unit tests ✓, **79 pgTAP RLS tests** ✓, plus
Playwright E2E for each feature.

### Before production launch — owner actions required
- **Legal**: fill the Impressum operator identity + data-protection contact
  (kept as marked placeholders — must be real). Have the AGB reviewed.
- **Revenue model (#1)**: still undecided — choose commission (Stripe Connect) /
  subscription / lead fees. This gates the deposit/payment hook in booking.
- **Gated integrations** (built, inert until configured):
  - `RESEND_API_KEY` + `EMAIL_FROM` — email notifications
  - Google OAuth client (dashboard / config.toml) — Google sign-in
  - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — analytics; `ERROR_WEBHOOK_URL` — error sink
- **Admin**: grant `is_admin` to real operator accounts
  (`update profiles set is_admin=true where id=…`).
- **Known gap**: dynamic OG images (`next/og`) crash in this environment —
  revisit on the deploy target.
- Run `next build` on the deploy target as the final pre-launch check.

### Deferred (post-launch, not in this pass)
- Payments / Stripe Connect (depends on revenue decision)
- Photographer-initiated booking cancellation
- Full availability calendar UI (current: blocked-date list)
