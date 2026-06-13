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
- **T3.1 SEO** — sitemap, structured data (Person/LocalBusiness), dynamic OG
  images for public photographer profiles. — ⬜
- **T3.2 Admin panel** — moderation, disputes, metrics (role-gated). — ⬜
- **T3.3 Availability calendar + favorites** — photographer availability; client
  saved photographers/shoots. — ⬜

---

## Progress log
(Updated as work lands on `feat/production-roadmap`.)
