# Demo Mode — design spec

**Date:** 2026-06-15
**Branch:** `feat/demo-mode` (must not touch `main`)
**Goal:** A backend-free, UI-only deployment of the full app on Vercel so a
client can explore how Rintakez works on realistic mock data — including
logging in as a photographer and as a client.

## Summary

When `NEXT_PUBLIC_DEMO_MODE=true`, the four Supabase client factories return a
**mock client** backed by an in-memory store seeded from fixtures. Every
existing page, Server Component, and Server Action keeps working unchanged
because they all already obtain Supabase through `createClient()` /
`createPublicClient()` / browser `createClient()` / `createAdminClient()`.
No real Supabase project is required.

The demo gives **full feature parity** with `main`: landing, photographer
listing + profiles (with photos, ratings, availability), client flow (post a
shoot, view bids, accept), photographer flow (browse, bid), messaging, reviews,
notifications, favorites, reports, admin. Writes are **interactive within the
session** (they mutate the in-memory store) and a "Reset demo" control re-seeds.

## Non-goals

- Multi-tenant isolation between concurrent demo visitors (the store is a
  server-side singleton; acceptable for a single-client demo).
- Durable persistence (store resets on Vercel cold start — by design).
- Real-time websockets (messaging refreshes via `router.refresh()` instead).
- Real email, OAuth, or external rate limiting (all become no-ops in demo).

## Activation

- Single flag: `NEXT_PUBLIC_DEMO_MODE` (must be `NEXT_PUBLIC_` so both server
  and browser factories can read it). A small `isDemo()` helper centralises the
  check.
- Default **off** → `main` behaviour and production are unaffected. All demo
  code lives behind the flag.

## Architecture

All new code under `src/lib/demo/`:

| File | Responsibility |
|---|---|
| `fixtures.ts` | The seed dataset (profiles, photographer_details, portfolio_images, shoots, bids, conversations, messages, reviews, notifications, favorites, photographer_unavailable) derived from `supabase/seed.sql` for Swiss realism, plus hosted image URLs. |
| `store.ts` | In-memory dataset (module-level singleton, server-side). Source of truth. `reseed()` restores fixtures. |
| `mock-client.ts` | Implements the subset of the supabase-js API the app uses: a chainable query builder over the store, `auth`, `rpc`, `storage`. |
| `personas.ts` | The two fake identities (one photographer, one client) and their login credentials. |
| `session.ts` | Demo auth via a `demo_user` cookie; read by mock `auth.getUser`/`getSession`, set by `signInWithPassword`, cleared by `signOut`. |

The four factories get a one-line guard at the top:
`if (isDemo()) return createMockClient(...)`. This is the only change to
existing `src/lib/supabase/*` files.

### Reads

The mock query builder interprets the chain
`.from(table).select(cols).eq().neq().in().or().contains().is().gte().lte().ilike().order().range().limit().single().maybeSingle()`
against the store arrays and returns `{ data, error }`. It supports the embedded
relation selects the app uses (e.g. `profiles(*)`, `bids(*, profiles(*))`) by
resolving foreign keys against the other store arrays. Only the query shapes the
app actually issues must be supported (enumerated from the codebase survey).

### Writes (interactive in session)

- `.insert` / `.update` / `.delete` mutate the relevant store array and return
  the affected rows.
- RPCs implement their state transition against the store:
  `accept_bid`, `decline_bid`, `complete_shoot`, `get_counterparty_email`,
  `set_initial_role`, `shoot_bid_count`.
- Because the store is a server-side singleton, mutations persist across
  navigation within a warm instance. A **Reset demo** Server Action calls
  `reseed()`.
- Messaging: `sendMessage` mutates the store; the thread view refreshes with
  `router.refresh()` (no websocket). Realtime subscriptions are no-ops in demo.

### Single source of truth

All reads/writes go through the **server-side** store via Server Components and
Server Actions. The browser mock client is used only for auth-session reads and
is otherwise minimised, avoiding a split-brain between server and browser
memory.

## Login (two fake accounts)

- The real login page is unchanged. In demo, mock `auth.signInWithPassword`
  matches the input against the two personas' credentials; on success it sets
  the `demo_user` cookie, on failure returns the same error shape as Supabase.
- `signUp`, `updateUser`, OAuth, and password reset return benign success/no-op
  in demo.
- The login page shows a small **demo-credentials banner** (photographer +
  client email/password) when `isDemo()` so the client knows what to enter.

## Images

- `storage.from(bucket).getPublicUrl(path)` returns the URL recorded in
  fixtures (hosted images, or assets under `public/demo/`).
- `upload` returns a fixed placeholder URL plus a success result so upload UIs
  don't error.

## Fixtures content (target)

- 6–8 photographers: avatar, 3–5 portfolio images each, bio, city/canton,
  ratings + a few reviews, some unavailable dates.
- 5–6 shoots across statuses (open / assigned / completed / cancelled) with
  bids; at least one assigned shoot with an open conversation + messages.
- Notifications and favorites for the two personas.

## Deployment

- Push `feat/demo-mode` → Vercel preview deployment (connect repo once).
- Set `NEXT_PUBLIC_DEMO_MODE=true` for that deployment. No Supabase env needed;
  the factory guard short-circuits before reading Supabase env vars.
- Optional: Vercel password protection on top of the in-app fake login.

## Testing

- Unit tests (Vitest) for the mock query builder: `eq`/`in`/`order`/`limit`/
  `single`/`maybeSingle`, an embedded-relation select, and one RPC
  (`accept_bid`) state transition.
- Existing unit + pgTAP + e2e suites stay green (demo code is behind the flag,
  default off).
- Manual: run locally with `NEXT_PUBLIC_DEMO_MODE=true`, walk both personas
  through the full flows.

## Risks / honest caveats

- Mock query builder must cover every query shape the app issues; a missed shape
  surfaces as an empty list or error on a specific page. Mitigation: enumerate
  from the survey, add unit tests, and walk every page manually.
- Global, non-durable store: concurrent visitors share state and a cold start
  resets it. Acceptable for a single-client demo; documented and a Reset button
  is provided.
