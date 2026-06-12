# Rintakez — Swiss Photography Marketplace: Production Design Spec

**Date:** 2026-06-13
**Status:** Approved by owner (pending written-spec review)
**Version:** 1.0

---

## 1. Product Summary

Rintakez is a two-sided marketplace for Switzerland connecting **clients** (couples, companies, institutions) who need photography with **professional photographers** (~4'000 registered firms in CH — the total addressable supply side).

Core loop (v1):

1. Client posts a **shoot** (type, location, date, duration, budget range in CHF, brief).
2. Photographers browse open shoots (filtered by canton, type, budget) and submit **bids** (price + message).
3. Client reviews bids and photographer profiles/portfolios, then **accepts one bid** (others auto-declined).
4. Contact details are exchanged; the job happens off-platform in v1.

Existing asset: a high-fidelity interactive design prototype (this repository) built as no-build React JSX — screens, theme tokens (`theme.css`), trilingual copy (`i18n.jsx`), and realistic Swiss sample data (`data.jsx`). The prototype is the **visual source of truth**; it is not production code and will not be shipped.

### Explicitly out of scope for v1 (deferred, but schema-anticipated)

| Feature | Target | Schema impact now |
|---|---|---|
| In-platform payments / commission | TBD (business model undecided) | `bids.status` lifecycle designed so a `payments` table can attach later without migration pain |
| Real-time chat | v1.1 | `conversations`/`messages` tables NOT created in v1; Supabase Realtime reserved |
| Email + push notifications | v1.1 | Events worth notifying are explicit status transitions — easy to hook later |
| Ratings & reviews | v1.1 | `shoots.status = 'completed'` is the future review trigger |
| Native mobile apps (Expo) | later | Same Supabase backend will serve them; no web-only shortcuts in the API layer |

---

## 2. Architecture

**Pattern:** Single Next.js application (frontend + server logic) backed by Supabase (managed Postgres + Auth + Storage). No separate API service.

```
[Browser / Phone (PWA, installable)]
            │
            ▼
┌────────────────────────────────────┐
│ Next.js 16 — App Router, TS        │
│ • React Server Components for      │
│   public/listing pages (SEO, fast) │
│ • Server Actions for mutations     │
│ • next-intl: /de /fr /en routes    │
│ • Tailwind v4 + shadcn/ui          │
│ Hosted on Vercel (fra1 functions)  │
└────────────────────────────────────┘
            │ supabase-js + @supabase/ssr
            ▼
┌────────────────────────────────────┐
│ Supabase — region Zürich           │
│   (AWS eu-central-2)               │
│ • Postgres 15 + Row Level Security │
│ • Auth: email/password + Google    │
│ • Storage: portfolio & avatars     │
│   (public bucket, CDN + on-the-fly │
│    image transforms)               │
└────────────────────────────────────┘
```

### Key decisions & rationale

| Decision | Rationale |
|---|---|
| Next.js + Supabase over custom backend | One person + AI tooling; auth/storage/RLS are solved problems; fastest path to production. Zero lock-in: standard Postgres, exportable via `pg_dump`. |
| Supabase region **Zürich** | Swiss data residency → nFADP (revDSG) compliance posture; ~5–20ms latency within CH. |
| **Server Actions + RSC**, no REST layer in v1 | Less surface area. When native apps arrive, supabase-js talks to the same database under the same RLS policies — RLS is the API contract, not Next.js routes. |
| **RLS as the security boundary** (not app code) | Every table gets policies; the anon key is safe to ship to browsers/apps by construction. App-layer checks are UX, not security. |
| Tailwind + shadcn/ui themed from existing `theme.css` | The approved visual design (colors, type scale, light/dark) carries over as CSS custom properties → design continuity without hand-porting prototype JSX. |
| Supabase **Pro plan ($25/mo) at launch** | Free tier pauses after 7 days idle (cold-start = "the app is slow"). Pro never pauses; covers 100k MAU — far above the entire Swiss market. Free tier is fine during development. |

### Scale sanity check

Worst-case 5-year volume: 4'000 photographers + ~40'000 clients, ~1'000 shoots/month × ~10 bids ≈ **~600k rows** in the largest table. With the indexes below, every query in this product is single-digit milliseconds. Scaling risk is not a design driver; correctness and security are.

---

## 3. Data Model (Postgres)

All tables in schema `public`, RLS **enabled on every table**, `created_at timestamptz default now()` everywhere. IDs are `uuid default gen_random_uuid()` unless noted.

### 3.1 `profiles`

One row per auth user, created by a trigger on `auth.users` insert.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `role` | enum `user_role` (`client`, `photographer`) | chosen at onboarding, immutable in v1 |
| `display_name` | text NOT NULL | person or studio name |
| `avatar_url` | text | Storage path |
| `city` | text | |
| `canton` | enum `canton` (26 values: `ZH`, `BE`, `VD`, …) | |
| `locale` | enum `locale` (`de`, `fr`, `en`) default `de` | UI + email language |
| `bio` | text | |

### 3.2 `photographer_details`

1:1 extension for photographers only.

| column | type | notes |
|---|---|---|
| `profile_id` | uuid PK → profiles | |
| `specialties` | `shoot_type[]` | enum array: `wedding`, `portrait`, `commercial`, `event`, `architecture`, `family`, `other` |
| `coverage_cantons` | `canton[]` | where they work |
| `hourly_rate_chf` | integer | indicative, public |
| `website_url`, `instagram_url` | text | |

### 3.3 `portfolio_images`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `photographer_id` | uuid → profiles | |
| `storage_path` | text NOT NULL | in `portfolio` bucket |
| `sort_order` | integer | drag-reorder later; insert order in v1 |

Limit: 20 images/photographer (enforced in action + DB trigger).

### 3.4 `shoots`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `client_id` | uuid → profiles | |
| `title` | text NOT NULL | |
| `type` | `shoot_type` | |
| `brief` | text NOT NULL | |
| `location_city` | text NOT NULL | |
| `location_postcode` | text | 4-digit CH postcode |
| `canton` | `canton` NOT NULL | filter key |
| `shoot_date` | date NOT NULL | must be future at creation |
| `duration_hours` | integer | 1–24 |
| `budget_min_chf`, `budget_max_chf` | integer | `CHECK (budget_max_chf >= budget_min_chf)` |
| `status` | enum `shoot_status` (`open`, `assigned`, `completed`, `cancelled`) default `open` | |
| `accepted_bid_id` | uuid → bids, nullable | set atomically on acceptance |

### 3.5 `bids`

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `shoot_id` | uuid → shoots | |
| `photographer_id` | uuid → profiles | |
| `amount_chf` | integer NOT NULL | within sanity bounds (CHECK > 0) |
| `message` | text NOT NULL | pitch to client |
| `status` | enum `bid_status` (`pending`, `accepted`, `declined`, `withdrawn`) default `pending` | |

`UNIQUE (shoot_id, photographer_id)` — one bid per photographer per shoot (editable while `pending`).

### 3.6 Indexes

- `shoots (status, canton, shoot_date)` — the browse query
- `shoots (client_id)`, `bids (shoot_id)`, `bids (photographer_id)`, `portfolio_images (photographer_id)`
- Pagination everywhere: keyset (`created_at, id`) on browse lists.

### 3.7 Critical transaction: bid acceptance

A single Postgres function `accept_bid(bid_id)` (SECURITY DEFINER, called via RPC) that atomically:

1. Verifies caller owns the shoot and shoot is `open` and bid is `pending`.
2. Sets bid → `accepted`; all sibling pending bids → `declined`.
3. Sets shoot → `assigned`, `accepted_bid_id`.

This prevents the race of two accepts / accept-after-cancel. **All multi-row state transitions live in DB functions, not in JS.**

### 3.8 RLS policy matrix (summary)

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `profiles` | everyone (public profiles) | trigger only | owner (not `role`) |
| `photographer_details` | everyone | owner w/ photographer role | owner |
| `portfolio_images` | everyone | owner | owner (delete: owner) |
| `shoots` | `open` → everyone; any status → owning client; `assigned` → also accepted photographer | authenticated client role | owning client, only while `open` (cancel anytime before completion) |
| `bids` | owning photographer; shoot's client | photographer role, shoot is `open`, not own shoot | owner while `pending` (withdraw/edit); accept path only via `accept_bid()` |

**Privacy rule:** photographers never see competitors' bids or count beyond what the client chooses to show (v1 shows only a bid count on the card, computed via a `security definer` counter view).

Contact exchange: when a bid is accepted, client and accepted photographer can each see the other's email (exposed via a `security definer` function gated on the accepted relationship — emails are never in publicly selectable columns).

---

## 4. Application Structure

```
src/
  app/
    [locale]/                  # next-intl segment: de | fr | en
      (public)/
        page.tsx               # landing: value prop + latest open shoots
        photographers/[id]/    # public photographer profile + portfolio
        shoots/                # public browse (read-only teaser, login-gated actions)
        login/  register/      # auth + role choice + onboarding
      (app)/                   # authenticated shell (tab bar mobile / sidebar desktop)
        home/                  # role-aware dashboard
        shoots/
          new/                 # client: multi-step post form (as designed)
          [id]/                # detail: client sees bids; photographer sees bid sheet
        my-shoots/             # client: own shoots by status
        my-bids/               # photographer: own bids by status
        profile/  settings/
  components/ui/               # shadcn/ui, themed from prototype theme.css
  components/...               # ShootCard, BidSheet, PortfolioGrid, CantonSelect…
  lib/supabase/                # server/client/middleware helpers (@supabase/ssr)
  lib/actions/                 # Server Actions: shoots.ts, bids.ts, profile.ts
  i18n/messages/{de,fr,en}.json  # migrated from prototype i18n.jsx
supabase/
  migrations/                  # SQL migrations — the single source of schema truth
  config.toml
e2e/                           # Playwright
```

- **Validation:** Zod schemas shared by forms (client) and Server Actions (server). DB CHECK constraints as last line.
- **Forms:** react-hook-form + Zod resolver. The multi-step "post a shoot" flow mirrors the prototype's step design.
- **Images:** client-side downscale before upload (max 2048px, ~max 5MB); rendered via Supabase image transforms (`width=`, `quality=`) + `next/image`.
- **Errors:** Server Actions return typed `{ ok } | { error }` results; toast layer mirrors prototype's toast design. Error pages per App Router conventions.

## 5. Responsive & PWA

- **Mobile-first:** phone layout matches the prototype (bottom tab bar, bottom-sheet bid flow, card lists). Desktop (`lg+`): sidebar nav, two-column shoot detail (brief | bids), 3-col browse grid.
- **PWA:** web manifest + minimal service worker (`@serwist/next`) → installable, app icon, splash. No offline-first complexity in v1; push notifications arrive with v1.1 notifications work.

## 6. i18n

- `next-intl` with locale prefix routes (`/de/...` default, `/fr`, `/en`) → indexable per language (SEO on google.ch).
- UI strings migrated from prototype `i18n.jsx` → `messages/*.json`. User content (briefs, bids) is single-language as written — no machine translation in v1.
- CHF formatting helper preserved from prototype: `CHF 3'200` (apostrophe thousands separator), dates `dd.MM.yyyy`.

## 7. Security & Compliance

- RLS on every table; anon key public by design; `service_role` key only in server env, never in client bundles.
- Supabase Auth: email/password (with confirmation) + Google OAuth. Middleware-protected `(app)` routes.
- nFADP posture: data in Zürich region; privacy policy + impressum pages (DE/FR/EN) required before launch; cookie usage minimal (auth only — no consent banner needed beyond disclosure).
- Rate limiting on auth via Supabase defaults; honeypot field on public forms.

## 8. Testing Strategy

| Layer | Tool | Coverage |
|---|---|---|
| E2E (critical paths) | Playwright | register→onboard (both roles); client posts shoot; photographer bids; client accepts → contact exchange + statuses; auth gating |
| RLS policies | pgTAP via `supabase test db` | the §3.8 matrix — every deny case asserted |
| Unit | Vitest | Zod schemas, CHF/date formatting, helpers |
| CI | GitHub Actions | typecheck + lint + unit on PR; E2E against local `supabase start` + `next build` |

RLS tests are non-negotiable: in this architecture the database **is** the security boundary.

## 9. Environments & Deployment

- **Local:** `supabase start` (Docker) + `next dev`. Seed script recreates prototype sample data (Zermatt wedding, Vitra editorial…) for dev realism.
- **Staging = Vercel previews** per PR, pointed at a separate free-tier Supabase project.
- **Production:** Vercel (functions region `fra1`, closest to Zürich) + Supabase Pro (Zürich). Custom domain + HTTPS via Vercel.
- **Migrations:** `supabase db push` via GitHub Action on merge to `main` — schema changes never applied by hand to prod.
- **Cost:** dev ≈ CHF 0/mo; production launch ≈ CHF 25–30/mo (Supabase Pro + domain), Vercel free tier until traffic justifies Pro ($20).

## 10. Build Phases (high level — detailed plan follows in implementation plan)

1. **Foundation** — repo, Next.js 16 + TS + Tailwind + shadcn themed from `theme.css`, next-intl scaffolding, Supabase local setup, CI skeleton.
2. **Schema & security** — all migrations (§3), RLS policies + pgTAP tests, `accept_bid` function, seed data.
3. **Auth & onboarding** — register/login (email + Google), role choice, profile onboarding (photographer: details + portfolio upload).
4. **Client flow** — post-shoot multi-step form, my-shoots, shoot detail with bid list, accept/decline.
5. **Photographer flow** — browse with filters (canton/type/budget), shoot detail, bid bottom-sheet, my-bids, withdraw/edit.
6. **Public & polish** — landing, public photographer profiles, SEO/meta per locale, PWA manifest+SW, error/empty states, dark mode.
7. **Launch hardening** — Playwright suite green in CI, RLS test pass, Lighthouse (mobile ≥ 90 perf), legal pages, prod Supabase + domain + go-live checklist.

Each phase ends with working, deployed software on a preview URL.

---

*Spec owner: Hadi Ademi. Built from the approved interactive prototype in this repository.*
