# Rintakez Plan 3: Client Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Clients can post a shoot (multi-step form), see and manage their shoots by status, view bids with photographer info on a shoot detail page, and accept or decline bids — spec phase 4.

**Architecture:** Server Actions (Zod-validated, identity from `getSessionUser()`) for create/cancel/accept/decline; RLS + the `accept_bid` DB function are the security boundary. RSC pages read via the user-session Supabase client. Bid acceptance calls the `accept_bid` RPC (atomic). After acceptance the client sees the photographer's contact via `get_counterparty_email`.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod, react-hook-form, @supabase/ssr (typed), next-intl, Playwright.

**Builds on:** Plan 2 (v0.2.0-auth). Auth shell, role-aware nav, typed client, format utils, ShootCard all exist. The nav already links client to `/shoots/new` and `/my-shoots`.

**Branch:** `feat/plan-3-client`.

---

## Conventions (same as Plan 2)

- Locale-aware `Link`/`redirect`/`useRouter` from `@/i18n/navigation`.
- Server Actions in `src/lib/actions/*.ts`, `"use server"`, return `{ ok: true; ... } | { ok: false; error: string }`.
- Zod schemas in `src/lib/validation/*.ts`, shared client+server.
- New translation keys added to all three of `src/i18n/messages/{de,fr,en}.json`, symmetric.
- `data-testid` on interactive elements for E2E.

---

## Task 1: Shoot validation schema + create action (TDD)

**Files:** Create `src/lib/validation/shoot.ts`, `src/lib/actions/shoots.ts`; Test `src/lib/validation/shoot.test.ts`.

- [ ] **Step 1: Write failing test** `src/lib/validation/shoot.test.ts` covering `createShootSchema`:
  - accepts a full valid shoot (`{ title:"Hochzeit in Zermatt", type:"wedding", brief:"Dokumentarischer Stil im Detail beschrieben.", locationCity:"Zermatt", locationPostcode:"3920", canton:"VS", shootDate:"2027-08-14", durationHours:10, budgetMinChf:3200, budgetMaxChf:4500 }`)
  - rejects title shorter than 3
  - rejects brief shorter than 10
  - rejects `budgetMaxChf < budgetMinChf`
  - rejects an invalid canton
  - rejects an invalid postcode (`"39"`, `"abcd"`); accepts omitted postcode
  - rejects a past `shootDate` (before today) — use a clearly past date "2020-01-01"
  - rejects `durationHours` 0 and 25
  Run → FAIL.

- [ ] **Step 2: Implement `src/lib/validation/shoot.ts`:**

```ts
import { z } from "zod";
import { CANTONS, SHOOT_TYPES } from "./photographer";

export const createShootSchema = z
  .object({
    title: z.string().min(3).max(120),
    type: z.enum(SHOOT_TYPES),
    brief: z.string().min(10).max(4000),
    locationCity: z.string().min(1).max(120),
    locationPostcode: z
      .string()
      .regex(/^[0-9]{4}$/)
      .optional()
      .or(z.literal("")),
    canton: z.enum(CANTONS),
    shootDate: z.string().refine((d) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parsed = new Date(d + "T00:00:00");
      return !Number.isNaN(parsed.getTime()) && parsed >= today;
    }, "date_must_be_future"),
    durationHours: z.coerce.number().int().min(1).max(24),
    budgetMinChf: z.coerce.number().int().positive().max(1000000),
    budgetMaxChf: z.coerce.number().int().positive().max(1000000),
  })
  .refine((v) => v.budgetMaxChf >= v.budgetMinChf, {
    path: ["budgetMaxChf"],
    message: "budget_range",
  });

export type CreateShootInput = z.infer<typeof createShootSchema>;
```

Run test → pass.

- [ ] **Step 3: Implement `src/lib/actions/shoots.ts`** with `createShootAction(raw)`:
  - parse with `createShootSchema` (→ `invalid_input`);
  - `getSessionUser()` (→ `unauthorized`);
  - `getProfile()` must be role `client` (→ `forbidden`);
  - insert into `shoots` mapping camelCase→snake_case (`client_id: user.id`, `location_postcode: locationPostcode || null`), `status` defaults to `open`;
  - `.select("id").single()`; on error return `{ ok:false, error: error.message }`;
  - `revalidatePath` for `/[locale]/(app)/my-shoots` and home;
  - return `{ ok: true, id }`.

- [ ] **Step 4:** typecheck + build + vitest green. Commit: `git commit -m "feat: shoot validation schema and create action"`.

---

## Task 2: Post-a-shoot form (multi-step)

**Files:** Create `src/app/[locale]/(app)/shoots/new/page.tsx`, `new/new-shoot-form.tsx`; add `createShoot` message keys.

The prototype designs this as a 5-step brief. Implement a clean multi-step form (steps can be grouped): **Step 1** type (ChipMultiSelect-like single-select, or a radio grid reusing the card style); **Step 2** location (city, postcode, canton select) + date + duration; **Step 3** budget (min/max) + title + brief; a review/submit. Keep it pragmatic — a single page with sectioned "steps" and Back/Next is acceptable as long as it's clean and mobile-friendly. Reuse the prototype's option-card aesthetic (`border-ink bg-surface` selected).

- [ ] **Step 1: Add translation keys** under `createShoot` namespace in all three catalogs: `title` ("Auftrag erstellen"/"Créer une mission"/"Post a shoot"), `stepType`, `stepWhere`, `stepDetails`, `fieldTitle`, `fieldBrief`, `briefPlaceholder`, `fieldCity`, `fieldPostcode`, `fieldCanton`, `fieldDate`, `fieldDuration`, `fieldBudgetMin`, `fieldBudgetMax`, `next`, `back`, `submit` ("Veröffentlichen"/"Publier"/"Publish"), `errorCreate`, `success`. (Reuse `shoot.types.*` for type labels.) Symmetric across files.

- [ ] **Step 2: Create `new-shoot-form.tsx`** (client): react-hook-form + `zodResolver(createShootSchema)`. A canton `<select>` listing the 26 codes. A type selector (cards). Multi-step via local `step` state with Back/Next (validate the current step's fields before advancing using `trigger([...])`). On final submit call `createShootAction`; on `{ok:true,id}` → `router.push("/shoots/" + id)` (detail page from Task 4) + refresh; on error show message. `data-testid`: `shoot-type-<value>`, `shoot-title`, `shoot-brief`, `shoot-city`, `shoot-postcode`, `shoot-canton`, `shoot-date`, `shoot-duration`, `shoot-budget-min`, `shoot-budget-max`, `shoot-next`, `shoot-back`, `shoot-submit`. Theme tokens; date input `type="date"` with `min` set to today.

- [ ] **Step 3: Create `new/page.tsx`** (server): require client role (`getProfile()`; if not client → `redirect("/home")`). Render the form with the `createShoot.title` heading.

- [ ] **Step 4: Verify** dev server: as a client (lena@example.ch) `/de/shoots/new` renders; submitting a valid shoot creates a row (check DB) and navigates to the detail route (may 404 until Task 4 — acceptable, but the row must exist). Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: multi-step post-a-shoot form"`.

---

## Task 3: My shoots list

**Files:** Create `src/app/[locale]/(app)/my-shoots/page.tsx`, `src/components/shoot-status-badge.tsx`; add `myShoots` keys.

- [ ] **Step 1: Add keys** under `myShoots`: `title` ("Meine Aufträge"/"Mes missions"/"My shoots"), `empty` ("Du hast noch keinen Auftrag erstellt."/"Tu n'as pas encore créé de mission."/"You haven't posted a shoot yet."), `create` (reuse createShoot.title), and status labels under `shoot.status`: `open` ("Offen"/"Ouvert"/"Open"), `assigned` ("Vergeben"/"Attribué"/"Assigned"), `completed` ("Abgeschlossen"/"Terminé"/"Completed"), `cancelled` ("Storniert"/"Annulé"/"Cancelled"). Plus `shoot.bidsCount` ("{count, plural, =0 {Keine Angebote} one {# Angebot} other {# Angebote}}" and FR/EN equivalents). Symmetric.

- [ ] **Step 2: Create `shoot-status-badge.tsx`** (server or pure component): given a `status`, render a small badge with `.label` styling; color: open → text-accent, assigned → text-ink, completed → text-mute, cancelled → text-mute-2. Uses `getTranslations("shoot")` → `status.<value>`.

- [ ] **Step 3: Create `my-shoots/page.tsx`** (server): `getProfile()` (client; non-client → redirect /home). Query own shoots: `select("id,title,type,location_city,canton,shoot_date,budget_min_chf,budget_max_chf,status")` `.eq("client_id", profile.id)` `.order("created_at",{ascending:false})`. For each shoot also show a bid count — use the `shoot_bid_count` RPC per shoot, or a single grouped query: simplest is to fetch counts via `.rpc("shoot_bid_count",{p_shoot_id:id})` per row (n+1 but small) OR select bids count through a relationship. Use the RPC per row for clarity. Render each as a Link to `/shoots/<id>` showing title, status badge, location, date, budget, bid count. Empty state when none, with a CTA Link to `/shoots/new`.

- [ ] **Step 4: Verify** as lena@example.ch: `/de/my-shoots` shows her seeded shoots with correct statuses (the seed gives her shoots in various states) and bid counts. Empty state path: (can't easily test without a fresh client; trust it). Build/lint/typecheck green. Commit: `git commit -m "feat: my-shoots list with status badges and bid counts"`.

---

## Task 4: Shoot detail (client view) + bids list

**Files:** Create `src/app/[locale]/(app)/shoots/[id]/page.tsx`, `src/components/bid-card.tsx`, `src/components/contact-reveal.tsx`; add `shootDetail` keys.

- [ ] **Step 1: Add keys** under `shootDetail`: `brief` ("Briefing"/"Briefing"/"Brief"), `details` ("Eckdaten"/"Détails"/"Details"), `offers` ("Angebote"/"Offres"/"Offers"), `noOffers` ("Noch keine Angebote. Die meisten Aufträge erhalten ihr erstes Angebot innerhalb weniger Stunden."/FR/EN), `accept` ("Annehmen"/"Accepter"/"Accept"), `decline` ("Ablehnen"/"Refuser"/"Decline"), `accepted` ("Angenommen"/"Accepté"/"Accepted"), `declined` ("Abgelehnt"/"Refusé"/"Declined"), `cancelShoot` ("Auftrag stornieren"/"Annuler la mission"/"Cancel shoot"), `contactTitle` ("Kontakt"/"Contact"/"Contact"), `contactHint` ("Ihr seid verbunden. Nehmt direkt Kontakt auf."/FR/EN), `confirmAccept` ("Dieses Angebot annehmen? Die anderen werden automatisch abgelehnt."/FR/EN), `byPhotographer` ("von"/"par"/"by"). Symmetric.

- [ ] **Step 2: Extend `src/lib/actions/shoots.ts`** with three actions:
  - `acceptBidAction(bidId: string)`: `getSessionUser()`; call `supabase.rpc("accept_bid", { p_bid_id: bidId })`; on error map to `{ ok:false, error }` (the DB function enforces ownership/state); revalidate the shoot detail + my-shoots; `{ ok:true }`. (Authorization is in the DB function — do not duplicate, but DO require a session.)
  - `declineBidAction(bidId: string)`: `getSessionUser()`; update the bid `status='declined'` where `id=bidId` — but RLS only lets the *photographer* update their own bid, not the client. So decline by the client must be allowed: simplest correct approach is to add a `decline_bid(p_bid_id)` SECURITY DEFINER DB function (mirrors accept: verifies caller owns the shoot, shoot is open, bid pending → set declined) in a NEW migration `supabase/migrations/<ts>_decline_bid.sql`, and call it via RPC. Implement that migration (grant execute to authenticated, revoke from public), then `acceptBidAction`-style wrapper `declineBidAction`. Add a pgTAP assertion for it (client can decline a pending bid on own shoot; photographer cannot decline via this function on someone else's shoot). Bump the plan() count.
  - `cancelShootAction(shootId: string)`: `getSessionUser()`; update `shoots set status='cancelled' where id=shootId and client_id=user.id` (RLS + status-FSM trigger allow open→cancelled and assigned→cancelled). Return result; revalidate.

- [ ] **Step 3: Create `bid-card.tsx`** (server component): props a bid joined with photographer profile (`{ id, amount_chf, message, status, photographer: { id, display_name, city, canton } }`) plus `canManage` (client + shoot open) and the action wiring. Show photographer name (Link to `/photographers/<id>` — may 404 until Plan 5, fine), location, amount (formatCHF), message, status badge. If `canManage` and status `pending`: an Accept button (in a `<form action={...}>` calling a server action bound to the bid id) and a Decline button. Use a confirm via a small client wrapper if needed, or a plain form (accept is reversible-ish via cancel; a confirm dialog is nice-to-have). `data-testid`: `bid-<id>`, `bid-accept-<id>`, `bid-decline-<id>`.

- [ ] **Step 4: Create `contact-reveal.tsx`** (server): given a shootId where the viewer is entitled (assigned/completed), call `supabase.rpc("get_counterparty_email", { p_shoot_id })`; render the email in a contact card. If the RPC errors (not entitled), render nothing.

- [ ] **Step 5: Create `shoots/[id]/page.tsx`** (server): await params; fetch the shoot by id (RLS scopes visibility). If not found → `notFound()`. Determine viewer: `getProfile()`. This page serves the CLIENT view primarily (photographer view comes in Plan 4 — for now, if the viewer is the owning client show the management view; if not the owner, show a read-only summary or `notFound()` — keep client-focused, photographers get their view in Plan 4). Render: header (title, status badge), details grid (type, location+canton, date, duration, budget — reuse format utils), brief. If owner + status `open`: a Cancel-shoot button. Offers section: fetch bids for this shoot joined with photographer profiles (`from("bids").select("id,amount_chf,message,status,photographer:profiles!bids_photographer_id_fkey(id,display_name,city,canton)").eq("shoot_id", id).order("created_at")`) — verify the FK name; if the embedded alias syntax differs, fetch bids then fetch profiles separately and zip. Render BidCards with `canManage = isOwner && shoot.status==='open'`. If `assigned`/`completed` and owner, render `<ContactReveal>`. Empty state when no bids.

- [ ] **Step 6: Verify** as lena@example.ch: open one of her OPEN seeded shoots with a bid → see the bid with Accept/Decline. Accept it → page shows the bid accepted, shoot becomes assigned, contact card reveals the photographer email, other bids declined. Re-run `npx supabase test db` (the decline_bid assertions included) → all pass. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: shoot detail with bids, accept/decline, contact reveal"`.

---

## Task 5: Playwright E2E — client journey

**Files:** Create `e2e/client-flow.spec.ts`.

- [ ] **Step 1:** Write `e2e/client-flow.spec.ts`:
  - Log in as `lena@example.ch` / `password123`.
  - **Post a shoot:** go to `/de/shoots/new`, fill all steps with a unique title (e.g. `E2E Shoot ${Date.now()}`), type wedding, city/canton/date(future)/duration/budget/brief, submit → land on `/de/shoots/<id>`; assert the title is visible and status badge shows "Offen".
  - **Appears in my-shoots:** go to `/de/my-shoots`, assert the new title is listed.
  - **Accept a bid:** use a seeded OPEN shoot that already has a bid (e.g. "Hochzeit in Zermatt" owned by lena, which has Marko's bid). Open it, click accept on the bid → assert status becomes "Vergeben" (assigned) and a contact card appears with an email.
  (If the seed's exact ownership/state drifted, adapt selectors but keep the journey intent. The accept test must exercise the real `accept_bid` path.)
  Use `data-testid` selectors. Generous timeouts for dev cold-compile.

- [ ] **Step 2:** Run `npm run test:e2e` → all specs (auth + client) green. Iterate without weakening assertions. Note: tests that mutate seed state (accepting a bid) make the suite order-sensitive across reruns — to stay idempotent, prefer creating a fresh shoot+bid within the test where feasible, or accept that `supabase db reset` is the precondition (the CI e2e job already resets). Document the precondition in a comment.

- [ ] **Step 3:** Commit: `git commit -m "test(e2e): client flow — post shoot, my-shoots, accept bid"`.

---

## Task 6: Review & merge

- [ ] **Step 1:** Full matrix: lint, typecheck, vitest, build, `supabase test db`, `test:e2e` — all green (run `supabase db reset` first so seed state is clean for e2e).
- [ ] **Step 2:** Dispatch a review: (a) spec compliance vs this plan; (b) security pass on the new actions + `decline_bid` migration (does decline_bid properly verify shoot ownership? can a client accept/decline on a shoot they don't own? does cancelShootAction respect the FSM? any action trusting client input for identity?).
- [ ] **Step 3:** Fix findings. Merge `feat/plan-3-client` → main (`--no-ff`), tag `v0.3.0-client`.

---

## Done =

- A client can post a shoot through a clean multi-step form, see it in My Shoots, open its detail, review bids with photographer info, and accept (atomic, others auto-declined) or decline individual bids, then see the chosen photographer's contact.
- `decline_bid` DB function added with RLS + pgTAP coverage.
- Client journey covered by Playwright E2E, green alongside auth E2E and the RLS suite.
- Next: Plan 4 (photographer flow — browse open shoots with filters, submit/edit/withdraw bids, my-bids).
