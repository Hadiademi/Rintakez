# Rintakez

A two-sided photography marketplace for Switzerland. Clients post shoots; professional photographers browse and bid; clients accept a bid and the two exchange contact details. Trilingual (DE / FR / EN), mobile-responsive, installable as a PWA.

Built from an approved design prototype (kept in [`prototype/`](prototype/) for reference) into a production Next.js + Supabase application.

## Tech stack

- **Next.js 16** (App Router, React Server Components, Server Actions, TypeScript, Turbopack)
- **Tailwind v4** themed from the prototype's design tokens (light + dark)
- **next-intl** — locale-prefixed routes `/de` `/fr` `/en`
- **Supabase** (Postgres + Auth + Storage), region **Zürich** for Swiss data residency
- **Row Level Security is the security boundary** — the anon key is public by design; every table has policies, and multi-row state transitions live in `SECURITY DEFINER` Postgres functions (`accept_bid`, `decline_bid`, `get_counterparty_email`)
- **Zod** validation shared by forms and Server Actions
- **Vitest** (unit), **pgTAP** (RLS policy tests), **Playwright** (E2E)
- Hand-written service worker for PWA install

## Local development

Prerequisites: Node 22+, Docker (for the Supabase local stack).

```bash
npm install
npx supabase start          # boots Postgres/Auth/Storage in Docker
cp .env.example .env.local  # fill with values from `npx supabase status`
npx supabase db reset       # applies migrations + dev seed
npm run dev                 # http://localhost:3000  → redirects to /de
```

Dev seed users (password `password123`): `lena@example.ch` (client), `marko@example.ch` / `claire@example.ch` (photographers).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm test` / `npx vitest run` | Unit tests |
| `npm run test:e2e` | Playwright E2E (needs Supabase up + a clean `db reset`) |
| `npm run db:start` / `db:reset` / `db:test` | Supabase stack / reset+seed / pgTAP RLS tests |
| `npm run db:types` | Regenerate `database.types.ts` (needs `supabase login`) |

## Project structure

```
src/
  app/[locale]/
    (public)/        login, register, photographers/[id], impressum, datenschutz
    (app)/           home, shoots (browse), shoots/new, shoots/[id], my-shoots, my-bids, onboarding
    page.tsx         landing
    layout.tsx       html shell, i18n provider, theme script, SEO metadata
  components/         UI (ShootCard, BidCard, BidSheet, AppNav, MobileTabBar, ThemeToggle, …)
  lib/
    actions/         Server Actions (auth, shoots, bids, photographer)
    validation/      Zod schemas
    supabase/        SSR clients + hand-authored Database types
    auth.ts          session/profile accessors
    format.ts        Swiss CHF/date formatting
  i18n/              next-intl routing + de/fr/en message catalogs
supabase/
  migrations/        schema, RLS + functions, security hardening, decline_bid
  tests/database/    pgTAP RLS assertions (28)
  seed.sql           dev seed (Swiss sample data)
e2e/                 Playwright specs (auth, client, photographer)
docs/superpowers/    design spec + per-plan implementation plans + launch runbook
```

## Status

| Milestone | Tag |
|---|---|
| Foundation & database (schema, RLS, i18n, landing) | `v0.1.0-foundation` |
| Auth & onboarding | `v0.2.0-auth` |
| Client flow (post shoot, accept bids) | `v0.3.0-client` |
| Photographer flow (browse, bid, my-bids) | `v0.4.0-photographer` |
| Public pages, PWA, polish | `v0.5.0-polish` |

**Deployment** is documented in [`docs/superpowers/plans/2026-06-13-plan-6-launch-runbook.md`](docs/superpowers/plans/2026-06-13-plan-6-launch-runbook.md) — it needs the owner's GitHub / Supabase / Vercel accounts.

**Deferred by design** (post-launch backlog): payments/commission (Stripe Connect, TWINT), ratings & reviews, real-time chat, notifications, password-reset flow, native apps (Expo against the same backend).
