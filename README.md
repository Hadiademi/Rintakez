<div align="center">

# Rintakez

**A two-sided photography marketplace for Switzerland.**

Clients post shoots, professional photographers browse and bid, and the two sides connect once a bid is accepted — trilingual, mobile-first, and installable as a PWA.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

</div>

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture & security](#architecture--security)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

Rintakez connects people who need photography with the professionals who provide it:

1. **Clients** post a shoot — type, location, date, budget — and receive bids.
2. **Photographers** browse open shoots, filter by what fits them, and place bids.
3. The client accepts a bid, after which both parties exchange contact details and message each other in-app.
4. Once the shoot is delivered, the client leaves a review that builds the photographer's public reputation.

The application is built on an approved design prototype (preserved in [`prototype/`](prototype/) for reference) and shipped as a production **Next.js + Supabase** app, hosted in the **Zürich** region for Swiss data residency. The interface is fully localized in **German, French, and English**.

## Features

- **Two-sided marketplace** — shoot posting, browsing, bidding, and bid acceptance/decline flows
- **In-app messaging** — threaded conversations between clients and photographers with unread tracking
- **Reviews & reputation** — clients rate completed shoots; ratings surface on public photographer profiles
- **Photographer profiles** — public, SEO-indexed pages with portfolio, availability, and reviews
- **Favorites & availability** — clients save photographers; photographers mark unavailable dates
- **Notifications** — in-app activity feed for bids, messages, and shoot status changes
- **Reporting & moderation** — users can report content; an admin surface handles review
- **Trilingual (DE / FR / EN)** — locale-prefixed routes via `next-intl`
- **Progressive Web App** — installable with a hand-written service worker
- **Observability** — client-side error reporting wired to a server action
- **Rate limiting** — abuse protection on sensitive server actions
- **Mobile-first & dark mode** — responsive layout themed from the prototype's design tokens

## Tech stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, React Server Components, Server Actions, Turbopack) |
| **Language** | TypeScript 5, React 19 |
| **Styling** | Tailwind CSS v4 (light + dark, prototype design tokens) |
| **i18n** | next-intl — locale-prefixed routes `/de` `/fr` `/en` |
| **Backend** | Supabase (Postgres + Auth + Storage), Zürich region |
| **Validation** | Zod — shared by forms and Server Actions |
| **Forms** | react-hook-form |
| **Testing** | Vitest (unit), pgTAP (RLS policy), Playwright (E2E) |
| **PWA** | Hand-written service worker |

## Architecture & security

- **Row Level Security is the security boundary.** The Supabase anon key is public by design; every table is protected by RLS policies. Multi-row state transitions live in `SECURITY DEFINER` Postgres functions (e.g. `accept_bid`, `decline_bid`, `get_counterparty_email`) rather than in application code.
- **Server Actions** handle all writes, with Zod validation shared between the client form and the server boundary.
- **Private contact details** are only exchanged after a bid is accepted, enforced at the database layer.
- **Rate limiting** guards sensitive actions against abuse.
- **RLS is regression-tested** with a pgTAP suite that asserts policy behavior on every migration.

## Getting started

**Prerequisites:** Node 22+, Docker (for the local Supabase stack).

```bash
npm install
npx supabase start            # boots Postgres / Auth / Storage in Docker
cp .env.example .env.local    # fill with values from `npx supabase status`
npx supabase db reset         # applies migrations + dev seed
npm run dev                   # http://localhost:3000 → redirects to /de
```

**Dev seed users** (password `password123`):

| Email | Role |
|---|---|
| `lena@example.ch` | Client |
| `marko@example.ch` | Photographer |
| `claire@example.ch` | Photographer |

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Playwright E2E (needs Supabase up + clean `db reset`) |
| `npm run db:start` | Start the Supabase stack |
| `npm run db:reset` | Reset DB: migrations + dev seed |
| `npm run db:test` | pgTAP RLS policy tests |
| `npm run db:types` | Regenerate `database.types.ts` (needs `supabase login`) |

## Project structure

```
src/
  app/[locale]/
    (public)/        login, register, photographers/[id], impressum, datenschutz
    (app)/           home, shoots (browse), shoots/new, shoots/[id], my-shoots,
                     my-bids, messages, onboarding
    page.tsx         landing
    layout.tsx       html shell, i18n provider, theme script, SEO metadata
  components/        UI (ShootCard, BidCard, BidSheet, AppNav, MobileTabBar,
                     Pagination, PublicNav, ThemeToggle, …)
  lib/
    actions/         Server Actions (auth, shoots, bids, photographer, messages,
                     reviews, reports, notifications, favorites, availability,
                     admin, observability)
    validation/      Zod schemas
    supabase/        SSR clients + hand-authored Database types
    auth.ts          session / profile accessors
    format.ts        Swiss CHF / date formatting
  i18n/              next-intl routing + de/fr/en message catalogs
supabase/
  migrations/        schema, RLS + functions, messaging, reviews, reports, admin…
  tests/database/    pgTAP RLS assertions
  seed.sql           dev seed (Swiss sample data)
e2e/                 Playwright specs (auth, client, photographer)
docs/superpowers/    design spec + per-plan implementation plans + launch runbook
```

## Testing

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm test` | Pure logic, validation, formatting |
| RLS policy | `npm run db:test` | pgTAP assertions on every table's RLS |
| E2E | `npm run test:e2e` | Auth, client, and photographer journeys |

## Deployment

Deployment is documented in the [launch runbook](docs/superpowers/plans/2026-06-13-plan-6-launch-runbook.md). It targets **Vercel** (app) + **Supabase** (database, Zürich region) and requires the owner's GitHub / Supabase / Vercel accounts.

## Roadmap

**Deferred by design** (post-launch backlog):

- Payments & commission (Stripe Connect, TWINT)
- Password-reset flow
- Native mobile apps (Expo against the same backend)

## License

Copyright © 2026 Rintakez. All rights reserved.

This is **proprietary, closed-source software** — see [`LICENSE`](LICENSE). It is **not** open source. No permission is granted to use, copy, modify, or distribute the code or design without the prior written authorization of Rintakez. "Rintakez" and its logo are trademarks of the Owner.
