# Photographer Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client invite a specific photographer to one of their open shoots from the public profile; the photographer is notified and bids through the existing flow.

**Architecture:** A new `shoot_invitations` table (RLS-gated insert) plus a `SECURITY DEFINER` trigger that creates the photographer's notification — mirroring the existing `bids` → `notify_bid_received` pattern. No change to the bid/accept transaction and no new shoot-visibility grants (open shoots are already visible to all). A `core/invites` + thin-action layer drives the insert; the profile page gains an "Invite to your shoot" CTA + shoot picker and a main-column hierarchy fix.

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript, Supabase (Postgres, RLS, triggers), next-intl (de/fr/en), Vitest, pgTAP (`npm run db:test`).

## Global Constraints

- No new shoot-visibility RLS grants — open shoots (`status='open' and not is_suspended`) are already visible to all; do not touch `shoots_select`/`can_view_shoot`.
- Notifications are created ONLY by `SECURITY DEFINER` triggers (users have no INSERT grant on `notifications`); the invite notification must follow that pattern.
- Reuse the existing helper `public.is_shoot_client(p_shoot_id uuid)` for ownership checks.
- Action/core return contract: `{ ok: true } | { ok: false; error: string }`.
- Core layer is framework-agnostic (no `"use server"`, no `next/cache`) — takes a Supabase client; the `"use server"` shell holds session/role/rate-limit/revalidate. (Same pattern as `src/lib/core/bids.ts`.)
- Migrations timestamped `YYYYMMDDHHMMSS_name.sql`. pgTAP tests in `supabase/tests/database/*.test.sql`. Run with `npm run db:test` (reset first with `npm run db:reset` when a new migration must load). Regenerate types with `SUPABASE_ACCESS_TOKEN=local npm run db:types`.
- i18n keys added to all three of `src/i18n/messages/{de,en,fr}.json`.
- No web regression: `npm run typecheck`, `npx vitest run`, `npm run build` green; `npm run db:test` shows only the 5 pre-existing stale failures (messaging_reviews t10; rls t49,53,54,55).

---

### Task 1: `shoot_invitations` table, notification type, trigger

**Files:**
- Create: `supabase/migrations/20260701020000_shoot_invitations.sql`
- Test: `supabase/tests/database/shoot_invitations.test.sql`

**Interfaces:**
- Produces: table `public.shoot_invitations(id, shoot_id, photographer_id, client_id, created_at)` with `unique(shoot_id, photographer_id)`; enum value `notification_type.'shoot_invitation'`; a `SECURITY DEFINER` helper `public.can_invite_to_shoot(p_shoot_id uuid) returns boolean`; a trigger creating a `shoot_invitation` notification for the invited photographer. `authenticated` may `select, insert`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/shoot_invitations.test.sql`:

```sql
-- shoot_invitations: a client can invite a photographer to their own OPEN shoot,
-- which notifies the photographer; duplicates and invalid targets are refused.
begin;
create extension if not exists pgtap;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-c@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Inv Client"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-p@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Inv Photographer"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'inv-c2@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Other Client"}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1',
   'Invite target shoot', 'portrait', 'A brief long enough to pass.', 'Bern', 'BE',
   '2027-09-01', 2, 500, 900);

-- Act as the shoot's client.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

-- 1: client can invite a photographer to their own open shoot
select lives_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  'client can invite a photographer to their own open shoot'
);

-- 2: the invited photographer got a shoot_invitation notification
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-0000-0000-0000000000f2'
     and type = 'shoot_invitation'
     and shoot_id = '10000000-0000-0000-0000-0000000000f1'),
  1,
  'the invited photographer receives a shoot_invitation notification'
);

-- 3: a duplicate invite is rejected by the unique constraint
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '23505',
  null,
  'a duplicate invite is rejected'
);

-- 4: inviting a non-photographer (a client) is refused by RLS
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f3',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '42501',
  null,
  'inviting a non-photographer is refused'
);

-- 5: a different client cannot invite on someone else's shoot
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select throws_ok(
  $$insert into public.shoot_invitations (shoot_id, photographer_id, client_id)
    values ('10000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000f2',
            '00000000-0000-0000-0000-0000000000f3')$$,
  '42501',
  null,
  'a non-owner cannot invite on another client''s shoot'
);

-- 6: the invited photographer can see the invitation row (select party)
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select is(
  (select count(*)::int from public.shoot_invitations
   where shoot_id = '10000000-0000-0000-0000-0000000000f1'
     and photographer_id = '00000000-0000-0000-0000-0000000000f2'),
  1,
  'the invited photographer can read their invitation'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run db:reset && npm run db:test`
Expected: FAIL — `relation "public.shoot_invitations" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260701020000_shoot_invitations.sql`:

```sql
-- Shoot invitations: a client invites a specific photographer to one of their
-- OPEN shoots. Reuses the bid model (the photographer still bids via submit_bid
-- and is accepted via accept_bid) — this row is just a targeted pointer plus a
-- notification. Insert is RLS-gated; the notification is created by a
-- SECURITY DEFINER trigger, mirroring bids -> notify_bid_received.

alter type public.notification_type add value if not exists 'shoot_invitation';

create table public.shoot_invitations (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shoot_id, photographer_id)
);

create index shoot_invitations_photographer_idx
  on public.shoot_invitations (photographer_id, created_at desc);

-- SECURITY DEFINER helper: the caller owns the shoot and it is open. Mirrors the
-- can_view_shoot precedent so the insert policy's subquery does not re-enter
-- shoots RLS.
create or replace function public.can_invite_to_shoot(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shoots s
    where s.id = p_shoot_id
      and s.client_id = auth.uid()
      and s.status = 'open'
      and not s.is_suspended
  );
$$;

alter table public.shoot_invitations enable row level security;

grant select, insert on public.shoot_invitations to authenticated;

-- INSERT: caller is the shoot's client, shoot is open, target is a real
-- photographer, and not the caller.
create policy "shoot_invitations_insert_client" on public.shoot_invitations
  for insert with check (
    client_id = auth.uid()
    and public.can_invite_to_shoot(shoot_id)
    and photographer_id <> auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = photographer_id and p.role = 'photographer'
    )
  );

-- SELECT: either party to the invitation.
create policy "shoot_invitations_select_party" on public.shoot_invitations
  for select using (
    photographer_id = auth.uid() or client_id = auth.uid()
  );

-- New invitation -> notify the invited photographer.
create or replace function public.notify_shoot_invitation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, type, shoot_id)
  values (new.photographer_id, 'shoot_invitation', new.shoot_id);
  return new;
end;
$$;

create trigger on_shoot_invitation_insert
  after insert on public.shoot_invitations
  for each row execute function public.notify_shoot_invitation();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run db:reset && npm run db:test`
Expected: PASS — `shoot_invitations.test.sql .. ok` (6 assertions); only the 5 pre-existing stale failures remain elsewhere.

- [ ] **Step 5: Regenerate DB types**

Run: `SUPABASE_ACCESS_TOKEN=local npm run db:types`
Expected: `src/lib/supabase/database.types.ts` now includes `shoot_invitations` and `can_invite_to_shoot`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260701020000_shoot_invitations.sql supabase/tests/database/shoot_invitations.test.sql src/lib/supabase/database.types.ts
git commit -m "feat(invite): shoot_invitations table, notification type + trigger"
```

---

### Task 2: `core/invites.ts` + `actions/invites.ts`

**Files:**
- Create: `src/lib/core/invites.ts`
- Create: `src/lib/core/invites.test.ts`
- Create: `src/lib/actions/invites.ts`

**Interfaces:**
- Consumes: `shoot_invitations` table (Task 1); `getProfile` from `@/lib/auth`; `rateLimit` from `@/lib/rate-limit`; `dbError` from `@/lib/action-error`; `createClient` from `@/lib/supabase/server`; `revalidatePath` from `next/cache`.
- Produces: `invitePhotographer(supabase, { photographerId, shootId, clientId }): Promise<{ ok: true } | { ok: false; error: string }>` (error `"already_invited"` on unique violation); `invitePhotographerAction(photographerId: string, shootId: string): Promise<{ ok: true } | { ok: false; error: string }>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/core/invites.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { invitePhotographer } from "@/lib/core/invites";

function fakeSupabase(insertResult: { error: { code?: string; message: string } | null }) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue(insertResult),
    }),
  } as never;
}

describe("invitePhotographer", () => {
  it("inserts the invitation and returns ok", async () => {
    const supabase = fakeSupabase({ error: null });
    const result = await invitePhotographer(supabase, {
      photographerId: "p1",
      shootId: "s1",
      clientId: "c1",
    });
    expect(result).toEqual({ ok: true });
  });

  it("maps a unique violation to already_invited", async () => {
    const supabase = fakeSupabase({ error: { code: "23505", message: "duplicate key" } });
    const result = await invitePhotographer(supabase, {
      photographerId: "p1",
      shootId: "s1",
      clientId: "c1",
    });
    expect(result).toEqual({ ok: false, error: "already_invited" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/core/invites.test.ts`
Expected: FAIL — cannot resolve `@/lib/core/invites`.

- [ ] **Step 3: Write `core/invites.ts`**

Create `src/lib/core/invites.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "@/lib/action-error";

export type InviteResult = { ok: true } | { ok: false; error: string };

export type InvitePhotographerInput = {
  photographerId: string;
  shootId: string;
  clientId: string;
};

/**
 * Inserts a shoot invitation. Framework-agnostic: the caller supplies an
 * authenticated Supabase client and the resolved client (inviter) id, so the
 * same function serves the web action today and a native client later. RLS
 * enforces ownership/role; the DB trigger creates the photographer's
 * notification.
 */
export async function invitePhotographer(
  supabase: SupabaseClient,
  input: InvitePhotographerInput
): Promise<InviteResult> {
  const { error } = await supabase.from("shoot_invitations").insert({
    shoot_id: input.shootId,
    photographer_id: input.photographerId,
    client_id: input.clientId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "already_invited" };
    return { ok: false, error: dbError(error, "shoot_invitations") };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/core/invites.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Write `actions/invites.ts`**

Create `src/lib/actions/invites.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { invitePhotographer } from "@/lib/core/invites";

type ErrResult = { ok: false; error: string };
type Ok = { ok: true };

export async function invitePhotographerAction(
  photographerId: string,
  shootId: string
): Promise<Ok | ErrResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "unauthorized" };
  // Only clients invite (they own the shoots).
  if (profile.role !== "client") return { ok: false, error: "forbidden" };
  if (!(await rateLimit(`invite:${profile.id}`, 30, 3_600_000)))
    return { ok: false, error: "limit_reached" };

  const supabase = await createClient();
  const result = await invitePhotographer(supabase, {
    photographerId,
    shootId,
    clientId: profile.id,
  });
  if (!result.ok) return result;

  revalidatePath("/[locale]/(app)/photographers/[id]", "page");
  revalidatePath("/[locale]/(app)/my-shoots", "page");
  return { ok: true };
}
```

- [ ] **Step 6: Verify no web regression**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck clean; all unit tests pass (including the 2 new).

- [ ] **Step 7: Commit**

```bash
git add src/lib/core/invites.ts src/lib/core/invites.test.ts src/lib/actions/invites.ts
git commit -m "feat(invite): core/invites + invitePhotographerAction"
```

---

### Task 3: Profile CTA, shoot picker, and main-column hierarchy fix

**Files:**
- Create: `src/components/invite-photographer-button.tsx`
- Modify: `src/app/[locale]/(app)/photographers/[id]/page.tsx`
- Modify: `src/i18n/messages/de.json`, `src/i18n/messages/en.json`, `src/i18n/messages/fr.json`

**Interfaces:**
- Consumes: `invitePhotographerAction` (Task 2).
- Produces: `<InvitePhotographerButton photographerId={string} openShoots={{ id: string; title: string }[]} />` client component rendering the CTA + picker.

- [ ] **Step 1: Add i18n keys**

In each of `src/i18n/messages/{de,en,fr}.json`, add these keys under the existing `"profile"` object (translate the values per locale; German shown, French/English analogous — use natural translations, keep placeholders):

de.json `profile`:
```json
"inviteCta": "Zu deinem Shooting einladen",
"invitePickTitle": "Shooting auswählen",
"inviteNoOpenShoots": "Du hast keine offenen Shootings.",
"inviteCreateShoot": "Shooting erstellen",
"inviteSuccess": "Einladung gesendet",
"inviteAlready": "Bereits eingeladen",
"inviteError": "Einladung fehlgeschlagen"
```
en.json `profile`:
```json
"inviteCta": "Invite to your shoot",
"invitePickTitle": "Choose a shoot",
"inviteNoOpenShoots": "You have no open shoots.",
"inviteCreateShoot": "Create a shoot",
"inviteSuccess": "Invitation sent",
"inviteAlready": "Already invited",
"inviteError": "Could not send invitation"
```
fr.json `profile`:
```json
"inviteCta": "Inviter à votre séance",
"invitePickTitle": "Choisir une séance",
"inviteNoOpenShoots": "Vous n'avez aucune séance ouverte.",
"inviteCreateShoot": "Créer une séance",
"inviteSuccess": "Invitation envoyée",
"inviteAlready": "Déjà invité",
"inviteError": "Échec de l'invitation"
```
Also add a notification label used by Task 4 under the existing `"notifications"` object (find it by searching for `"bid_received"` or the notifications label group; add a `shoot_invitation` sibling):
- de: `"shoot_invitation": "Du wurdest zu einem Shooting eingeladen"`
- en: `"shoot_invitation": "You were invited to a shoot"`
- fr: `"shoot_invitation": "Vous avez été invité à une séance"`

- [ ] **Step 2: Write the client component**

Create `src/components/invite-photographer-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { invitePhotographerAction } from "@/lib/actions/invites";

type OpenShoot = { id: string; title: string };

export function InvitePhotographerButton({
  photographerId,
  openShoots,
}: {
  photographerId: string;
  openShoots: OpenShoot[];
}) {
  const t = useTranslations("profile");
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null); // shootId invited
  const [error, setError] = useState<string | null>(null);

  async function invite(shootId: string) {
    setPending(shootId);
    setError(null);
    const res = await invitePhotographerAction(photographerId, shootId);
    setPending(null);
    if (res.ok) {
      setDone(shootId);
    } else {
      setError(res.error === "already_invited" ? t("inviteAlready") : t("inviteError"));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="press bg-ink px-5 py-3 text-center text-sm font-medium text-paper"
      >
        {t("inviteCta")}
      </button>

      {open && (
        <div className="space-y-2 rounded-md border border-line bg-surface p-3">
          <p className="label text-mute">{t("invitePickTitle")}</p>
          {openShoots.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] text-mute">{t("inviteNoOpenShoots")}</p>
              <Link
                href="/shoots/new"
                className="text-[14px] text-accent underline underline-offset-2"
              >
                {t("inviteCreateShoot")}
              </Link>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {openShoots.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={pending === s.id || done === s.id}
                    onClick={() => invite(s.id)}
                    className="press w-full truncate rounded border border-line bg-paper px-3 py-2 text-left text-[14px] text-ink disabled:opacity-60"
                  >
                    {done === s.id ? `✓ ${t("inviteSuccess")}` : s.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="text-[13px] text-accent">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire the profile page — fetch open shoots + render CTA, fix hierarchy**

In `src/app/[locale]/(app)/photographers/[id]/page.tsx`:

(a) Add the import near the other component imports:
```tsx
import { InvitePhotographerButton } from "@/components/invite-photographer-button";
```

(b) In the per-viewer dynamic section (right after `isSaved` is computed, still inside the `if (viewer && viewer.id !== id)` area — but open shoots are only relevant for clients), fetch the client's open shoots:
```tsx
  let openShoots: { id: string; title: string }[] = [];
  if (viewer && viewer.role === "client") {
    const supabase = await createClient();
    const { data: os } = await supabase
      .from("shoots")
      .select("id, title")
      .eq("client_id", viewer.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    openShoots = os ?? [];
  }
```
(If a `const supabase = await createClient();` already exists in that scope from the `isSaved` fetch, reuse it instead of re-declaring.)

(c) In the identity-card CTA block, replace the client branch that currently renders the `postShootCta` Link:
```tsx
              {viewer?.role === "client" ? (
                <Link
                  href="/shoots/new"
                  className="press bg-ink px-5 py-3 text-center text-sm font-medium text-paper"
                >
                  {t("postShootCta")}
                </Link>
              ) : !viewer ? (
```
with the invite button for clients (keep the anonymous branch unchanged):
```tsx
              {viewer?.role === "client" ? (
                <InvitePhotographerButton
                  photographerId={profile.id}
                  openShoots={openShoots}
                />
              ) : !viewer ? (
```

(d) Hierarchy fix — in the main column (`<div className="mt-10 min-w-0 space-y-10 lg:mt-2">`), move the **bio** block and the **Portfolio** block so the order is: **bio → portfolio → details → reviews**, and move the **unavailable dates** block from the top of the column to just after the details section (so the column no longer opens with unavailability). Do not change the markup of each block — only their order.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run build`
Expected: clean typecheck and successful build.

- [ ] **Step 5: Commit**

```bash
git add src/components/invite-photographer-button.tsx "src/app/[locale]/(app)/photographers/[id]/page.tsx" src/i18n/messages/de.json src/i18n/messages/en.json src/i18n/messages/fr.json
git commit -m "feat(invite): profile invite CTA + shoot picker; fix profile hierarchy"
```

---

### Task 4: Notification routing for `shoot_invitation`

**Files:**
- Modify: `src/components/notification-bell.tsx`

**Interfaces:**
- Consumes: the `shoot_invitation` notification type (Task 1) and its i18n label (added in Task 3 Step 1).

- [ ] **Step 1: Route the new type to the shoot page**

In `src/components/notification-bell.tsx`, in `hrefFor`, add `shoot_invitation` to the shoot-destination branch so an invited photographer lands on the shoot:
```tsx
  if (
    (item.type === "bid_received" ||
      item.type === "shoot_cancelled" ||
      item.type === "shoot_reopened" ||
      item.type === "shoot_invitation") &&
    item.shootId
  )
    return `/shoots/${item.shootId}`;
```

- [ ] **Step 2: Confirm the label renders**

Verify the bell's label lookup resolves `shoot_invitation` (added under `notifications` in Task 3 Step 1). If the bell renders labels via `t(item.type)` on the `notifications` namespace, no code change is needed beyond the JSON key. If it uses an explicit map, add a `shoot_invitation` entry mirroring the sibling types.

Run: `npm run typecheck && npm run build`
Expected: clean.

- [ ] **Step 3: Manual smoke (optional, if local Supabase running)**

As a client, invite a photographer to an open shoot; sign in as that photographer and confirm the bell shows the invitation and links to the shoot.

- [ ] **Step 4: Commit**

```bash
git add src/components/notification-bell.tsx
git commit -m "feat(invite): route shoot_invitation notifications to the shoot"
```

---

## Self-Review

**Spec coverage:**
- `shoot_invitations` table + RLS + trigger + notification type → Task 1. ✅
- core/invites + thin action → Task 2. ✅
- Profile CTA + shoot picker + hierarchy fix → Task 3. ✅
- Notification routing + i18n label → Task 4 (+ Task 3 Step 1). ✅
- No new shoot-visibility grant → honored (Global Constraints; no `shoots_select` change). ✅
- Testing (pgTAP + Vitest + regression) → Task 1 test, Task 2 test, verify steps. ✅
- Out-of-scope items (withdraw/expire, bulk, invited-list, messaging) → not planned. ✅

**Placeholder scan:** No TBD/TODO; every code step shows real code. i18n values are provided per locale. The only judgment step is Task 3 Step 3(d) reordering existing blocks (order specified explicitly).

**Type consistency:** `invitePhotographer(supabase, { photographerId, shootId, clientId })` and `invitePhotographerAction(photographerId, shootId)` consistent across Tasks 2 and 3. `already_invited` consistent across core mapping and UI handling. `shoot_invitation` enum value consistent across Task 1 (SQL), Task 4 (routing), and i18n label. Table columns (`shoot_id`, `photographer_id`, `client_id`) consistent across migration, test, and core insert.

## Execution Handoff

Subagent-driven per task with review after each, then a whole-branch review.
