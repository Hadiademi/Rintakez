# Photographer Invite — Design Spec

**Date:** 2026-07-01
**Branch:** `feat/photographer-invite`
**Status:** Approved direction (brainstorming) — pending user spec review

## Goal

Close the conversion gap on the public photographer profile: today a client who
wants a *specific* photographer can only "Save" them or post a generic open shoot.
This feature lets a client **invite a specific photographer to one of their open
shoots**. The photographer is notified and bids through the existing flow. This
makes the profile page an engagement surface, not just a directory entry — the
lever that turns profile views into bookings (and, downstream, subscription value
for photographers).

## Context — existing model (verified in code)

- **Flow today:** client posts a shoot (`status = 'open'`) → any photographer
  browses and bids (`bids`) → client accepts (`accept_bid`). No way to reach a
  specific photographer.
- **Shoot visibility:** `shoots_select` already exposes every `status = 'open' and
  not is_suspended` shoot to all authenticated users. So an invited photographer can
  *already view* the open shoot — no RLS visibility change is needed. The invite's
  value is the **notification + surfacing**, not new access.
- **Notifications:** `public.notifications` rows are created **only** by
  `SECURITY DEFINER` triggers (users have no INSERT grant), keyed by
  `notification_type` enum (extended via `alter type ... add value if not exists`).
  The bell (`src/components/notification-bell.tsx`) routes each type to a
  destination and renders a localized label.
- **Bidding:** `submit_bid` RPC (this repo) places/revives a bid; unchanged here.

## Architectural decisions

- **Reuse the bid model.** An invite does not create a new booking primitive; it is a
  pointer ("this client wants this photographer on this shoot") plus a notification.
  The photographer still bids via `submit_bid`; the client still accepts via
  `accept_bid`. No change to the core transaction.
- **Mirror the existing bid→notification pattern.** The `shoot_invitations` INSERT is
  gated by RLS (like `bids`), and a `SECURITY DEFINER` trigger on insert creates the
  photographer's notification (exactly like `on_bid_insert` → `notify_bid_received`).
  This keeps notification creation forge-proof and consistent with the codebase.
- **No new visibility grants.** Because open shoots are already visible to all, we do
  NOT widen `shoots_select`/`can_view_shoot`. Fewer moving parts, smaller attack
  surface.
- **YAGNI.** MVP excludes: withdrawing/expiring invites, bulk invites, an
  invited-photographers list on the client's shoot page, and pre-booking private
  messaging. These are follow-ups if demand appears.

## Components

### 1. `shoot_invitations` table (migration)
```
id              uuid pk default gen_random_uuid()
shoot_id        uuid not null references public.shoots(id) on delete cascade
photographer_id uuid not null references public.profiles(id) on delete cascade
client_id       uuid not null references public.profiles(id) on delete cascade  -- the inviter (= shoot owner)
created_at      timestamptz not null default now()
unique (shoot_id, photographer_id)
```
RLS (`enable row level security`):
- **INSERT** policy `shoot_invitations_insert_client`: `with check` that
  `client_id = auth.uid()`, the shoot is the caller's own AND `status = 'open' and not
  is_suspended` (via a `SECURITY DEFINER` helper mirroring the ownership check, to
  avoid re-triggering `shoots` RLS inside the subquery — follow the `can_view_shoot`
  precedent), the target `photographer_id` has role `photographer`, and
  `photographer_id <> auth.uid()`.
- **SELECT** policy `shoot_invitations_select_party`: `photographer_id = auth.uid() or
  client_id = auth.uid()`.
- No UPDATE/DELETE grants (MVP).
- `grant select, insert on public.shoot_invitations to authenticated`.

### 2. `notification_type` += `shoot_invitation` (migration)
`alter type public.notification_type add value if not exists 'shoot_invitation';`

### 3. Notification trigger (migration)
`SECURITY DEFINER` function `notify_shoot_invitation()` + `after insert` trigger on
`shoot_invitations`, inserting `notifications(user_id = new.photographer_id, type =
'shoot_invitation', shoot_id = new.shoot_id)`. Mirrors `notify_bid_received`.

### 4. Server action + core (`src/lib/core/invites.ts`, `src/lib/actions/invites.ts`)
Following the established core/thin-action pattern:
- `core/invites.ts`: `invitePhotographer(supabase, { photographerId, shootId })` →
  inserts the row; maps unique-violation to `already_invited`; returns
  `{ ok: true } | { ok: false; error }`.
- `actions/invites.ts`: `"use server"` shell — resolves the client profile, checks
  role `client`, rate-limits (`invite:<id>`, 30 per hour → `rateLimit("invite:"+id,
  30, 3_600_000)`), delegates to core, revalidates relevant views.

### 5. UI — profile CTA + shoot picker (`src/app/[locale]/(app)/photographers/[id]/page.tsx` + a client component)
- Replace/augment the profile's primary CTA (client viewers only) with **"Invite to
  your shoot"**. Photographers viewing a peer, and anonymous visitors, keep the
  current behavior (no invite button; anon → login CTA).
- Clicking opens a lightweight picker (new client component, e.g.
  `invite-photographer-button.tsx` + a sheet) listing the client's **open** shoots;
  selecting one calls the action. If the client has no open shoots, the picker offers
  "Create a shoot" → `/shoots/new`. Success + already-invited states are surfaced
  inline.
- **Profile hierarchy fix (folded in, since we are here):** in the main column,
  order **bio → portfolio → details → reviews**, and move the **unavailable dates**
  out of the lead position (it currently opens the column with a negative signal).
  Reframe it under the details/availability grouping.

### 6. Notification routing + i18n
- `notification-bell.tsx`: route `shoot_invitation` → the shoot page (`/shoots/[id]`).
- Add localized labels for `shoot_invitation` and the profile CTA / picker strings in
  `src/i18n/messages` (de, fr, en). Follow existing key conventions.

## Data flow

Client on profile → "Invite to your shoot" → picks an open shoot → action → `insert
into shoot_invitations` (RLS-gated) → `SECURITY DEFINER` trigger → `notifications` row
for the photographer → bell shows it (realtime) → photographer opens the shoot →
`submit_bid` → `accept_bid`. Unchanged transaction, new entry point.

## Error handling

- Action/core return the standard `{ ok: true } | { ok: false; error }` contract.
- `already_invited` (unique violation) surfaces as a friendly "already invited" state,
  not an error toast.
- RLS denials (not your shoot, shoot not open, target not a photographer) fail closed;
  the picker only offers valid targets/shoots so these are defense-in-depth.

## Testing

- **pgTAP** (`supabase/tests/database/shoot_invitations.test.sql`): a client can
  invite a photographer to their own open shoot; the notification row is created;
  duplicate invite raises unique violation; a non-owner cannot invite on someone
  else's shoot (42501); inviting a non-photographer or a closed shoot is refused.
- **Vitest** (`src/lib/core/invites.test.ts`): `invitePhotographer` maps success and
  `already_invited`.
- **No web regression:** `npm run typecheck`, `npx vitest run`, `npm run build`, and
  `npm run db:test` (only the 5 pre-existing stale failures may remain).

## Out of scope

Withdraw/expire invites; bulk invite; invited-list on the client shoot page;
pre-booking messaging; any change to the bid/accept transaction; cover-image and
trust-signal profile polish (separate UI pass).

## Success criteria

- A client can invite a photographer to an open shoot from the profile; the
  photographer receives an in-app notification linking to the shoot and can bid.
- Duplicate/invalid invites are handled gracefully; RLS proves only a shoot's own
  client can invite, only to a real photographer, only on an open shoot.
- Profile main-column hierarchy leads with bio/portfolio, not unavailability.
- All existing tests stay green.
