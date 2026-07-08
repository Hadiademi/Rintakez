# Launch Hardening Implementation Plan

> Executed subagent-driven (implementer + review per task). Derived from the multi-agent platform audit (2026-07-01). **Payment/Stripe work is explicitly EXCLUDED** — deferred until the owner's client decides the pricing model. This plan builds everything else: liquidity loops, retention emails, trust hygiene, SEO, and measurement.

**Goal:** Turn Rintakez from a solid CRUD marketplace into a platform with working supply/demand loops, trust signals, discoverability, and measurement — without any billing code.

**Tech Stack:** Next.js 16 + React 19 + TS, Supabase (Postgres/RLS/triggers/Storage), next-intl (de/fr/en), Vitest, pgTAP, Resend via durable email outbox + Vercel cron.

## Global Constraints

- **NO payment/Stripe/billing/plan-gating code.** No `plan`/`subscription`/`featured`/paywall. Measurement tables are allowed (they don't gate anything).
- No web regression: `npm run typecheck`, `npx vitest run`, `npm run build` green; `npm run db:test` only the 5 known-stale failures.
- Reuse existing patterns: email via `src/lib/email.ts` outbox (`EmailKind` + `notifyEmail` + `render`) drained by `/api/cron/process`; notifications only via SECURITY DEFINER triggers; core/thin-action split (`src/lib/core/*`); rate limiting via `src/lib/rate-limit.ts`; i18n keys in all three of `src/i18n/messages/{de,en,fr}.json`.
- Migrations timestamped `YYYYMMDDHHMMSS_name.sql`; pgTAP in `supabase/tests/database/`; run `npm run db:reset && npm run db:test`; regen types `SUPABASE_ACCESS_TOKEN=local npm run db:types`.
- Every user-facing string trilingual; French uses informal **tu** to match app voice.

---

## Batch A — Complete & harden the invite loop

### Task A1: Invite notification email
Add `shoot_invitation` to `EmailKind` in `src/lib/email.ts` (subject + trilingual body linking to `/shoots/[id]`), and call `notifyEmail({ kind: "shoot_invitation", recipientId: photographerId, shootId })` from `invitePhotographerAction` (best-effort, after the successful insert), gated by the photographer's `notify_*` preference where the pattern dictates. Acceptance: an invited photographer receives an email (visible in the outbox); existing email tests still pass.

### Task A2: Harden the invite insert policy
Migration + pgTAP: add `not public.is_suspended()` and a `user_blocks` check (client not blocked-by/ blocking the photographer) to `shoot_invitations_insert_client` (mirror the guards in `20260622010000_moderation.sql` / `20260622030000_blocks.sql`). Acceptance: a suspended client cannot invite (42501); a blocked pair cannot invite; happy path still passes.

---

## Batch B — First-session relevance (liquidity)

### Task B1: Personalize the photographer home feed
In `src/app/[locale]/(app)/home/page.tsx` (photographer branch, currently 7 newest global shoots), filter open shoots by the photographer's `coverage_cantons` and `disciplines` from `photographer_details`, with a "show all" fallback when the filtered set is small/empty. Acceptance: a photographer sees canton/discipline-matched shoots first; empty-match still shows something.

### Task B2: Personalize RecommendedPhotographers
In `src/components/recommended-photographers.tsx` + its caller, soft-boost by the client's canton and recent shoot types (using `coverage_cantons`/`specialties`), keeping rating as the base sort. Acceptance: recommendations reflect the viewer's locality.

### Task B3: Zero-bid rescue CTAs
Turn the inert "no offers yet" empty state (`src/app/[locale]/(app)/shoots/[id]/page.tsx`) and the my-shoots 0-offer rows into CTAs linking to `/photographers` pre-filtered by the shoot's canton + type. Acceptance: a client with a 0-bid shoot gets a one-click path to invite photographers.

---

## Batch C — Retention engine (matched alerts + lifecycle emails)

### Task C1: Matched-shoot alert emails
On shoot insert, fan out an email (+ optional notification) to photographers whose `coverage_cantons` ∩ shoot canton and `disciplines`/`specialties` match, respecting `notify_*` prefs, via the outbox. Prefer a SECURITY DEFINER trigger enqueuing `email_outbox` rows (so it fires regardless of client), or a server-side fan-out in the shoot-create action. Add `shoot_match` EmailKind. Rate/volume-guard the fan-out. Acceptance: posting a Zürich wedding emails Zürich photo photographers, not a Geneva videographer.

### Task C2: Lifecycle emails on the existing cron
Add: welcome (on signup), incomplete-onboarding reminder (photographer with no `photographer_details` after N days), zero-bid rescue to the client (shoot open with 0 bids after 3 days), review request to the client (shoot completed, no review after N days). Implement as cron-driven scans enqueuing outbox rows (extend `/api/cron/process` or a sibling cron), idempotent (don't re-send). Add the EmailKinds + trilingual copy. Acceptance: each trigger enqueues exactly once.

### Task C3: Email deliverability + first impression
Batch/debounce `message_received` emails (`src/lib/actions/messages.ts` currently one email per message) — e.g. suppress if an unread email for that conversation was sent within a window. Add a "manage notification preferences" footer link to `render()` in `src/lib/email.ts`. Acceptance: a burst of messages in one thread does not send one email each.

---

## Batch D — Trust & safety hygiene

### Task D1: Profile trust signals + remove fake avatars
Add `member-since` (profile `created_at`) and `completed-shoots count` to photographer profile (`photographers/[id]/page.tsx`) and `photographer-card.tsx`. Remove the Unsplash stock-portrait fallback (`src/lib/shoot-image.ts` / `photographerAvatar`) in favor of the existing monogram fallback. Acceptance: no external stock faces render for photographers; profiles show tenure + track record.

### Task D2: Admin alerting + auth rate limits
Enqueue an `email_outbox` row (or notification) to the admin on new `reports`/`disputes` insert (trigger or action). Add `rateLimit()` to `register`/`login`/`password-reset` actions in `src/lib/actions/auth.ts`. Acceptance: a new report pages the admin; auth endpoints are throttled.

### Task D3: Review integrity + reporting depth
Add a `report_category` enum (spam/harassment/scam/inappropriate_content/other) and extend `report_target` with `review` + `message` (migration + pgTAP + `report-button.tsx`). Add friction/flagging on the fake-review vector (flag same-party/repeat patterns for admin review; the audit notes 2 free accounts can mint verified reviews). Extend `exportMyData` (`src/lib/actions/privacy.ts`) with reports, disputes, user_blocks, notifications, shoot_invitations. Acceptance: reports carry a category; a review/message can be reported; export is complete.

### Task D4: Enforce availability
Guard `accept_bid` (migration) to refuse when the photographer has a `photographer_unavailable` row for the shoot date OR an existing same-date assigned shoot; gray out/annotate unavailable photographers in the invite picker and directory for a given date. Acceptance: cannot accept/book an unavailable photographer (pgTAP proves the 42501/refusal); picker shows availability.

---

## Batch E — SEO & discovery

### Task E1: Metadata + hreflang
Add `generateMetadata` (localized title/description) to `/photographers`, `/shoots`, `/shoots/[id]`. Replace the static homepage-only `alternates.languages` map in `src/app/[locale]/layout.tsx` with per-request path-aware alternates + canonical. Acceptance: each page type has localized metadata; hreflang points to the same path per locale.

### Task E2: Sitemap + OG + JSON-LD + image perf
Extend `src/app/sitemap.ts` with `/shoots`, `/photographers`, and open shoot detail URLs per locale (`lastModified` from `updated_at`). Add a static `/opengraph-image` brand card + dynamic OG for photographer profiles. Add Organization + WebSite (SearchAction) JSON-LD to the homepage. Add `loading="lazy"`/`decoding="async"`/dimensions to `CoverImage` (or convert to `next/image`; `**.supabase.co` already in `remotePatterns`). Acceptance: sitemap covers key pages; shared links preview; images lazy-load.

### Task E3: Programmatic SEO landing pages (LARGE — build last)
Canton × shoot-type indexable landing pages in de/fr/en (e.g. `Hochzeitsfotograf Zürich`) with unique copy + a listing snapshot + sitemap entries, from the `CANTONS`/`SHOOT_TYPES` enums. Acceptance: `/photographers/zuerich/hochzeit`-style routes render, are indexable, and link into the directory. (Scope may be trimmed; if trimmed, log what was dropped.)

---

## Batch F — Measurement (no gating)

### Task F1: Profile-view / impression counters
Insert-only counter table(s) (`profile_views`, optionally `directory_impressions`) with RLS (owner-read, insert via a definer helper or anon-insert with care) recording views of a photographer profile. No UI. Acceptance: viewing a profile records a row; a photographer can read their own counts; no one reads others'.

### Task F2: Funnel + liquidity instrumentation
Add Plausible custom events for the funnel (signup → post shoot → bid → accept) where the client components already load Plausible. Add liquidity counts to the admin dashboard: zero-bid open-shoot count, median bids per open shoot, time-to-first-bid, invites sent (7d). Acceptance: admin sees liquidity health; funnel events fire.

---

## Deferred (payment — NOT in this plan)
Stripe Checkout + webhook, subscriptions/customers tables, `plan` entitlement field + gating, `/pricing`, customer portal, dunning, Swiss VAT invoicing, plan-aware portfolio cap, featured/boost lever, the gated photographer analytics dashboard UI. Measurement (Batch F) intentionally lands first so the future dashboard has history.

## Execution notes
Batches are ordered by launch value. Within a batch, tasks are mostly independent; execute sequentially with review after each. Some tasks share files (email.ts, the profile page) — sequence those to avoid conflicts.
