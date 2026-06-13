# Rintakez Plan 4: Photographer Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Photographers can browse open shoots with filters (canton / type / budget), open a shoot to see its brief, submit a bid (and edit/withdraw it while pending), and track all their bids in a My Bids view — spec phase 5. This closes the two-sided marketplace loop.

**Architecture:** RSC pages read open shoots and the photographer's own bids via the user-session Supabase client (RLS scopes everything). Server Actions (Zod-validated, identity from `getSessionUser()`) create/edit/withdraw bids; RLS enforces "photographer role, shoot open, not own shoot, one bid per shoot, edit only while pending". The shoot detail page gains a photographer branch (brief + bid sheet) alongside the existing client branch.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod, react-hook-form, @supabase/ssr (typed), next-intl, Playwright.

**Builds on:** Plan 3 (v0.3.0-client). Schema/RLS for bids exists (`bids_insert_photographer`, `bids_update_own_pending`, unique per shoot). ShootCard, format utils, status badge, auth shell, nav links to `/shoots` and `/my-bids` already present.

**Branch:** `feat/plan-4-photographer`.

---

## Conventions: same as Plans 2–3 (locale-aware nav; actions return `{ok}|{error}`; shared Zod; symmetric i18n; data-testid).

---

## Task 1: Bid validation schema + actions (TDD)

**Files:** Create `src/lib/validation/bid.ts`, `src/lib/actions/bids.ts`; Test `src/lib/validation/bid.test.ts`.

- [ ] **Step 1: Failing test** `src/lib/validation/bid.test.ts` for `createBidSchema`:
  - accepts `{ amountChf: 3800, message: "Ruhiger dokumentarischer Stil, ehrlich." }`
  - rejects `amountChf` 0 and negative
  - rejects message shorter than 10
  - rejects message longer than 2000
  Run → FAIL.

- [ ] **Step 2: Implement `src/lib/validation/bid.ts`:**

```ts
import { z } from "zod";

export const createBidSchema = z.object({
  amountChf: z.coerce.number().int().positive().max(1000000),
  message: z.string().min(10).max(2000),
});

export type CreateBidInput = z.infer<typeof createBidSchema>;
```

Run → pass.

- [ ] **Step 3: Implement `src/lib/actions/bids.ts`** ("use server") with:
  - `submitBidAction(shootId: string, raw: unknown)`: parse (→ invalid_input); `getSessionUser()` (→ unauthorized); insert into `bids` `{ shoot_id: shootId, photographer_id: user.id, amount_chf, message }`. RLS enforces role + shoot-open + not-own-shoot + uniqueness; on a unique-violation error return `{ ok:false, error:"already_bid" }` (detect Postgres code `23505` via `error.code`), else map other errors. revalidate the shoot detail + my-bids. Return `{ ok:true }`.
  - `updateBidAction(bidId: string, raw: unknown)`: parse; `getSessionUser()`; update `bids set amount_chf, message where id=bidId and photographer_id=user.id` (RLS also requires status pending). Return result; revalidate.
  - `withdrawBidAction(bidId: string)`: `getSessionUser()`; update `bids set status='withdrawn' where id=bidId and photographer_id=user.id` (RLS: pending only; WITH CHECK allows pending→withdrawn). Return result; revalidate.

- [ ] **Step 4:** typecheck + build + vitest + lint green. Commit: `git commit -m "feat: bid validation schema and bid actions"`.

---

## Task 2: Browse open shoots with filters

**Files:** Create `src/app/[locale]/(app)/shoots/page.tsx`, `src/components/shoot-filters.tsx`; add `browse` keys.

The browse list reads `searchParams` (canton, type, budgetMax) and filters server-side. Filters are a client component that pushes query params.

- [ ] **Step 1: Add keys** under `browse`: `title` ("Offene Aufträge"/"Missions ouvertes"/"Open shoots"), `count` (ICU plural: DE "{count, plural, =0 {Keine Aufträge} one {# Auftrag} other {# Aufträge}}", FR "{count, plural, =0 {Aucune mission} one {# mission} other {# missions}}", EN "{count, plural, =0 {No shoots} one {# shoot} other {# shoots}}"), `filterCanton` ("Kanton"/"Canton"/"Canton"), `filterType` ("Art"/"Type"/"Type"), `filterBudget` ("Budget bis"/"Budget jusqu'à"/"Budget up to"), `all` ("Alle"/"Toutes"/"All"), `clear` ("Zurücksetzen"/"Réinitialiser"/"Clear"), `empty` ("Keine offenen Aufträge passen zu deinen Filtern."/"Aucune mission ouverte ne correspond à tes filtres."/"No open shoots match your filters."). Symmetric.

- [ ] **Step 2: Create `shoot-filters.tsx`** (client): three controls — canton `<select>` (All + 26 cantons), type `<select>` (All + SHOOT_TYPES with `shoot.types.*` labels via useTranslations), budgetMax number input — plus a Clear link. On change, build a URLSearchParams and `router.push(pathname + "?" + params)` using `useRouter`/`usePathname` from `@/i18n/navigation` and reading current values from `useSearchParams()` (from `next/navigation`). data-testid: `filter-canton`, `filter-type`, `filter-budget`, `filter-clear`.

- [ ] **Step 3: Create `shoots/page.tsx`** (server): `getProfile()` — this is the photographer browse; if not a photographer, still allow viewing (open shoots are public to authed users) but the page is primarily for photographers; if no profile → redirect to /login. Read `searchParams` (await it — it's a Promise in Next 16): `canton`, `type`, `budgetMax`. Build the query: `from("shoots").select("id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf").eq("status","open")`, conditionally `.eq("canton", canton)` if set & valid, `.eq("type", type)` if set & valid, `.lte("budget_min_chf", Number(budgetMax))` if a valid number (interpret "budget up to" as shoots whose minimum is within the photographer's ceiling). `.order("created_at",{ascending:false})`. Render heading + count + `<ShootFilters/>` + a responsive grid of links to `/shoots/<id>` (reuse ShootCard, wrapped in a Link). Empty state when none.

- [ ] **Step 4: Verify** as a photographer (marko@example.ch): `/de/shoots` lists open shoots; selecting a canton filters; budget filter narrows. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: browse open shoots with canton/type/budget filters"`.

---

## Task 3: Photographer view of shoot detail + bid sheet

**Files:** Modify `src/app/[locale]/(app)/shoots/[id]/page.tsx` (add photographer branch); Create `src/components/bid-sheet.tsx`, `src/components/my-bid-panel.tsx`; add `bidSheet` keys.

- [ ] **Step 1: Add keys** under `bidSheet`: `submitTitle` ("Angebot abgeben"/"Soumettre une offre"/"Submit an offer"), `yourPrice` ("Dein Preis (CHF)"/"Ton prix (CHF)"/"Your price (CHF)"), `yourMessage` ("Nachricht an den Kunden"/"Message au client"/"Message to the client"), `messagePlaceholder` ("Worauf legst du den Fokus? Wie ist dein Stil?"/"Quel est ton angle ? Décris ton approche."/"What's your focus? Describe your style."), `send` ("Angebot senden"/"Envoyer l'offre"/"Send offer"), `clientBudget` ("Budget des Kunden: {range}"/"Budget du client : {range}"/"Client budget: {range}"), `alreadyBid` ("Du hast bereits ein Angebot abgegeben."/"Tu as déjà soumis une offre."/"You've already submitted an offer."), `yourBid` ("Dein Angebot"/"Ton offre"/"Your bid"), `edit` ("Bearbeiten"/"Modifier"/"Edit"), `withdraw` ("Zurückziehen"/"Retirer"/"Withdraw"), `save` ("Speichern"/"Enregistrer"/"Save"), `bidStatusPending` ("Ausstehend"/"En attente"/"Pending"), `bidStatusAccepted` ("Angenommen — Glückwunsch!"/"Acceptée — félicitations !"/"Accepted — congrats!"), `bidStatusDeclined` ("Abgelehnt"/"Refusée"/"Declined"), `errorSubmit` ("Konnte nicht gesendet werden."/"Échec de l'envoi."/"Could not send."), `notOpen` ("Dieser Auftrag nimmt keine Angebote mehr an."/"Cette mission n'accepte plus d'offres."/"This shoot is no longer accepting offers."). Symmetric.

- [ ] **Step 2: Create `bid-sheet.tsx`** (client): props `{ shootId: string; budgetRange: string }`. A form (react-hook-form + zodResolver(createBidSchema)): amountChf number input, message textarea. Submit calls `submitBidAction(shootId, values)`; on `{ok:true}` → `router.refresh()`; on `already_bid` show alreadyBid message; on error show errorSubmit. Show the client budget hint. data-testid: `bid-amount`, `bid-message`, `bid-submit`.

- [ ] **Step 3: Create `my-bid-panel.tsx`** (client): props `{ bid: { id, amount_chf, message, status }; canEdit: boolean }`. Shows the photographer's existing bid with a localized status line. If `canEdit` (status pending): an Edit toggle that reveals an inline form (amount + message) calling `updateBidAction(bid.id, values)`, and a Withdraw button calling `withdrawBidAction(bid.id)` (with confirm). On success `router.refresh()`. data-testid: `mybid-status`, `mybid-edit`, `mybid-withdraw`, `mybid-amount`, `mybid-message`, `mybid-save`.

- [ ] **Step 4: Modify `shoots/[id]/page.tsx`** to add the photographer branch. Current logic: owner-client → management view; otherwise read-only summary. New logic when `profile.role === "photographer"` and not owner (a photographer can't own a shoot): render the brief + details (read-only) PLUS bid interaction:
  - fetch this photographer's existing bid on the shoot: `from("bids").select("id,amount_chf,message,status").eq("shoot_id", id).eq("photographer_id", profile.id).maybeSingle()` (RLS lets a photographer see their own bid).
  - if a bid exists → render `<MyBidPanel bid={...} canEdit={bid.status==='pending' && shoot.status==='open'} />`.
  - else if `shoot.status === 'open'` → render `<BidSheet shootId={id} budgetRange={formatCHFRange(min,max)} />`.
  - else → show `bidSheet.notOpen`.
  Keep the existing client-owner branch intact. Make sure a photographer never sees other photographers' bids (they don't — only their own is fetched).

- [ ] **Step 5: Verify** as marko@example.ch: open an open shoot he hasn't bid on → bid sheet; submit a bid → panel shows his pending bid with edit/withdraw; edit it; withdraw it; on a shoot he already bid (seed: Hochzeit in Zermatt) → see his existing bid. As marko on a non-open shoot → notOpen. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: photographer shoot detail with bid sheet and bid management"`.

---

## Task 4: My Bids list

**Files:** Create `src/app/[locale]/(app)/my-bids/page.tsx`; add `myBids` keys.

- [ ] **Step 1: Add keys** under `myBids`: `title` ("Meine Angebote"/"Mes offres"/"My bids"), `empty` ("Du hast noch kein Angebot abgegeben."/"Tu n'as pas encore soumis d'offre."/"You haven't placed a bid yet."), `browseCta` ("Aufträge durchsuchen"/"Parcourir les missions"/"Browse shoots"). Reuse `bidSheet.bidStatus*` or add bid status labels under a `bid.status` namespace: pending ("Ausstehend"/"En attente"/"Pending"), accepted ("Angenommen"/"Acceptée"/"Accepted"), declined ("Abgelehnt"/"Refusée"/"Declined"), withdrawn ("Zurückgezogen"/"Retirée"/"Withdrawn"). Symmetric.

- [ ] **Step 2: Create `my-bids/page.tsx`** (server): `getProfile()` (photographer; non-photographer → redirect /home). Fetch the photographer's bids joined with the shoot: `from("bids").select("id,amount_chf,message,status,created_at,shoot:shoots!bids_shoot_id_fkey(id,title,type,location_city,canton,shoot_date,status)").eq("photographer_id", profile.id).order("created_at",{ascending:false})` (verify FK name `bids_shoot_id_fkey`; if different use the correct name or two-query zip). Render each as a Link to `/shoots/<shoot.id>` showing the shoot title, the bid amount (formatCHF), the bid status (localized, with a small colored dot/badge), and the shoot location/date. Empty state with a CTA Link to `/shoots`. data-testid: `my-bids-list`, `my-bid-<id>`.

- [ ] **Step 3: Verify** as marko@example.ch: `/de/my-bids` shows his seeded bid(s) with status. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: my-bids list for photographers"`.

---

## Task 5: Playwright E2E — photographer journey

**Files:** Create `e2e/photographer-flow.spec.ts`.

- [ ] **Step 1:** Precondition comment (db reset). Tests (DE locale, login helper for `claire@example.ch` / `password123` — a photographer with NO seeded bid on the open shoots, so she can place fresh ones; verify her seed state first via psql, pick a photographer who can bid on an OPEN shoot she hasn't bid on):
  - **browse + filter:** login as the photographer; goto `/de/shoots`; assert open shoots listed; select a canton filter that matches at least one open shoot; assert the URL gains the query param and the list updates.
  - **submit a bid:** open an OPEN shoot the photographer hasn't bid on (e.g. "Porträtserie für Forschungsteam" — verify it's open with no bid from this photographer); fill `bid-amount` and `bid-message`; submit; assert the page now shows the my-bid panel with pending status.
  - **appears in my-bids:** goto `/de/my-bids`; assert the shoot title is listed with the bid.
  - **withdraw:** from the shoot detail or my-bids, withdraw the bid (handle confirm dialog); assert status becomes withdrawn or the bid sheet returns.
  Choose the photographer + shoot so the journey is clean on a fresh `supabase db reset`. Use generous timeouts; the config already runs serially (workers:1).

- [ ] **Step 2:** `npx supabase db reset` then `npm run test:e2e` — ALL specs (auth + client + photographer) green. Iterate without weakening.

- [ ] **Step 3:** Commit: `git commit -m "test(e2e): photographer flow — browse, bid, my-bids, withdraw"`.

---

## Task 6: Review & merge

- [ ] **Step 1:** Full matrix (reset first): lint, typecheck, vitest, build, `supabase test db`, `test:e2e` — all green.
- [ ] **Step 2:** Dispatch a security review of the bid actions + photographer detail branch: can a photographer bid on their own shoot / a non-open shoot / twice (RLS must block; actions map errors)? Can they see competitors' bids anywhere in the new pages (must not)? Can they edit/withdraw a bid that isn't theirs or isn't pending? Does submitBidAction trust client-supplied photographer_id (must use user.id)? Fix findings.
- [ ] **Step 3:** Merge `feat/plan-4-photographer` → main (`--no-ff`), tag `v0.4.0-photographer`.

---

## Done =

- Photographers browse open shoots with canton/type/budget filters, open a shoot to read its brief, submit a bid, edit or withdraw it while pending, and track all bids in My Bids — never seeing competitors' bids.
- The full marketplace loop works end-to-end: client posts → photographer bids → client accepts → both see contact.
- Photographer journey covered by Playwright E2E; the RLS suite still green.
- Next: Plan 5 (public pages — landing polish, public photographer profiles; PWA install; dark mode; error/empty states; SEO; the deferred error-code mapping).
