# Mobile-Ready Backend — Design Spec

**Date:** 2026-07-01
**Branch:** `feat/mobile-ready-backend`
**Status:** Approved (brainstorming) — pending implementation plan

## Goal

Prepare the Rintakez backend so a future native iOS/Android app (built with Expo /
React Native) can reuse it, **without** building the mobile UI yet and **without**
risking the imminent web launch. The output of this branch is:

1. A reusable, framework-agnostic business-logic layer (`src/lib/core/`).
2. Two-to-three critical flows exposed as Postgres RPC functions callable directly
   by any Supabase client (web or mobile).
3. A verified RLS posture — every table safe when a client connects **directly** to
   Supabase (as a native app will).
4. A minimal Expo "walking skeleton" proving end-to-end auth (device → Supabase →
   authenticated session) against **local** Supabase.

Non-goal for this branch: full migration of all 16 server actions, any real mobile
UI beyond the login proof, push notifications, and App Store / Play Store submission.
Those belong to the later "mobile app" phase.

## Context — current architecture

- **Auth:** Supabase Auth owns `auth.users` (email/password + Google OAuth).
  Passwords are hashed by Supabase in the protected `auth` schema; the app never
  stores them. Sessions are JWTs, held in cookies on web via `@supabase/ssr`.
- **Profiles:** `public.profiles.id → auth.users(id) on delete cascade`, 1:1 with a
  login. Holds `role` (client/photographer), `display_name`, `canton`, `locale`,
  `is_admin`, `is_suspended`, notification prefs. Photographers extend via
  `photographer_details` + `portfolio_images`.
- **Data model:** 17 tables — profiles, photographer_details, portfolio_images,
  shoots, bids, conversations, messages, notifications, reviews, favorites,
  photographer_unavailable, reports, disputes, user_blocks, audit_log,
  email_outbox, shoot_images.
- **Security:** RLS enabled on 17 tables with 53 policies.
- **Business logic:** 16 server-action files (`"use server"`) hold validation (Zod),
  role checks, rate limiting, side effects (email), and non-trivial rules (e.g. bid
  revival, accept-bid). This logic is Next.js-coupled and **not reachable by a native
  client** today. This is the real work.

## Architectural decisions (from brainstorming)

- **Mobile talks to Supabase directly** — simple reads/writes go straight to Supabase
  (RLS protects them); complex rules move into **Postgres RPC** functions
  (`SECURITY INVOKER`, so RLS still applies). No new backend service.
- **Native stack (future):** Expo / React Native. Chosen over Flutter to reuse the
  team's TypeScript/React skills, `supabase-js`, Zod schemas, generated DB types, and
  the new `core` layer — one language, one source of truth, lower long-term
  maintenance. Flutter's strengths (heavy custom UI/animation) do not apply to a CRUD
  marketplace.
- **Local Supabase, single repo** for this phase. Real-device testing (which needs a
  cloud Supabase project) is deferred to the mobile phase. The Expo proof lives in a
  `/mobile` directory in this repo.

## Components

### 1. `src/lib/core/` — pure business logic
Extract logic out of server actions into pure functions that take explicit inputs
(e.g. a Supabase client, the actor's profile, validated payload) and return results —
no `"use server"`, no `next/cache`, no cookies.

- `src/lib/actions/<x>.ts` becomes a thin `"use server"` shell that resolves the
  session/profile and delegates to `src/lib/core/<x>.ts`.
- Each core unit answers: what it does, how to call it, what it depends on. It is unit-
  testable in isolation.
- **Scope this branch:** establish the pattern and migrate the 2-3 flows that back the
  RPCs below (bids: submit + accept, and one supporting flow). Remaining actions are
  migrated incrementally later.

### 2. Postgres RPC for critical flows
Write `plpgsql` functions (`SECURITY INVOKER`) for the complex, multi-step flows so
web and mobile share one implementation:

- `submit_bid` — insert-or-revive-withdrawn logic currently in `bids.ts`.
- `accept_bid` — accept + decline-siblings + state transitions.
- (One supporting flow if it naturally pairs, otherwise stop at two.)

Side effects that currently live in server-action code (email) move to **DB triggers
→ Supabase webhook / `email_outbox`** so they fire regardless of which client
initiated the change. Rate limiting for these flows moves DB-side (or is documented as
a follow-up if it can't be cleanly moved this branch).

### 3. RLS verification
Audit all 17 tables for direct-connection safety: is every table protected when a user
connects straight to Supabase (bypassing server actions)? Any gap → new policy + test.
This hardens the web launch too.

### 4. Expo walking skeleton (`/mobile`)
Minimal Expo app, one screen: log in with Supabase (local), obtain a session, display
"signed in as X". Uses `supabase-js` + `expo-secure-store` for the session. Proves the
auth path end-to-end. Not wired to business features.

## Data flow

**Web today:** Browser → server action (reads JWT from cookie) → role check →
Supabase query (RLS re-checks) → response.

**After this branch:**
- Web → thin server action → `core/` function → Supabase / RPC (RLS enforced).
- Mobile (future) → `supabase-js` (JWT from secure storage) → same RPC / tables (RLS
  enforced). Same account, same rules, no divergence.

## Error handling

- `core/` functions return typed results (`{ ok: true } | { ok: false, error }`),
  matching the existing action contract, so the web UI is unaffected.
- RPC functions raise typed SQL errors mapped to the same error codes the actions
  already surface (e.g. `already_bid`, `forbidden`).
- RLS denials surface as clean "forbidden"/empty results, not raw DB errors — mirror
  the current sibling-action behavior.

## Testing

- **Unit:** Vitest tests for extracted `core/` functions (pure logic — easy to cover).
- **DB:** `supabase db test` (pgTAP) for the new RPC functions and the RLS policies —
  assert both allowed and denied paths per table touched.
- **Manual:** Expo login proof verified against local Supabase (login succeeds,
  session persists, identity shown).
- Existing web behavior must remain green: `npm run test`, `npm run typecheck`,
  `npm run build`.

## Out of scope (explicit)

Migrating all 16 actions; full mobile UI; push notifications (APNs/FCM/Expo Push);
device file uploads; EAS Build & store submission; cloud Supabase; legal/store
compliance forms. These are the later mobile-app phase, tracked separately.

## Success criteria

- `core/` layer exists with the pattern established and the 2-3 critical flows migrated.
- RPCs for `submit_bid` and `accept_bid` exist, tested, and used by the web path.
- RLS audit complete; any gaps closed with tests proving direct-connection safety.
- Expo login proof runs against local Supabase and authenticates successfully.
- Web test/typecheck/build all pass — no regression to the launching web app.
