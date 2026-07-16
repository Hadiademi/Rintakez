# Admin Dashboard — Design Spec

**Date:** 2026-07-15
**Branch:** `feat/admin-dashboard` (off `main` @ `892f67e`)
**Source:** Owner-supplied visual mockups (4 screens: Overview, Users, Pricing, Briefs)

---

## Context

The admin panel works but never received the Atelier editorial treatment the rest
of the app got, and it has no visibility into the subscription system that shipped
in `feat/payments`. The owner produced four mockups showing an admin with a
sidebar shell, KPI cards, a revenue chart, plan distribution, an activity feed, and
a Briefs (shoots) table.

**The mockups are a visual direction, not a complete information architecture.**
This spec reconciles them with what actually exists.

### What exists today

- `/admin` with 7 pages: overview (metrics), users, reports, verifications,
  disputes, audit, email. Gated by `profiles.is_admin`; reads via service role.
- Overview already shows: user/photographer/shoot/open-shoot counts, 7d/30d
  signups, liquidity stats (`admin_liquidity_stats` RPC), and a "needs attention"
  grid (reports, verifications, suspended, failed emails, disputes).
- Subscription system: `subscriptions` table, `photographer_effective_tier` view
  (the single tier source), `src/lib/billing/*`, admin `grantComp`/`revokeComp`.
- Cron: `/api/cron/process` every 5 minutes (`vercel.json`).

### Mock vs reality — reconciled

| Mock shows | Reality | Decision |
|---|---|---|
| Sidebar: Overview, Users, Pricing, Briefs | 7 pages exist | Keep all; add sections |
| Free/Studio/Atelier/Agency · 0/29/79/199 | free/basic/standard/premium · 0/59/119/229 | Mock is placeholder art; **keep real plans** |
| "Add plan" / "Edit" / toggle | Plans are code constants + 6 Stripe price env vars | **Read-only** + link to Stripe |
| MRR CHF 61'340 | Computable from `subscriptions` | Build it |
| 12-month revenue bar chart | No history (`subscriptions.user_id` is PK, overwritten) | New `revenue_monthly` rollup |
| "Spend CHF 948" per user | No booking payments (Connect deferred) | Replace with **MRR contribution** |
| Briefs page | Does not exist — admin cannot see shoots | **Build it** (real gap) |
| Recent activity LIVE | Does not exist | Build via RPC + polling |
| Global search (users, briefs, invoices) | Invoices are not an entity | **Out of scope** |
| Bulk-select checkboxes | No bulk actions exist | **Out of scope** |
| "R. Studer · Super admin" | Only an `is_admin` boolean; no role hierarchy | Show the real admin's name, no role tiers |

---

## Goals

1. Bring the admin to the Atelier editorial standard the rest of the app holds.
2. Give the business real visibility into subscription revenue (MRR, plan mix,
   month-over-month) without inventing numbers.
3. Close the Briefs gap — admins currently cannot see shoots at all.
4. Preserve every existing operational function (moderation, KYC, disputes,
   audit, email outbox).

## Non-goals

- Renaming or repricing plans (owner confirmed: mock names/prices are placeholder).
- Editing plan prices from the admin (see "Rejected" below).
- Booking-payment / spend tracking (Stripe Connect stays deferred).
- Global admin search, bulk user actions, admin role hierarchy.
- Full 390px parity for every admin page (see "Mobile" below).

## Rejected: admin-editable plan prices

The mock's "Add plan" / "Edit" / toggle implies plans are DB rows. They are not:
they are constants in `src/lib/billing/plans.ts` plus six `STRIPE_PRICE_*` env
vars, and **Stripe is the source of truth for what a customer is actually
charged**. An admin editing "CHF 79" in our UI would not change Stripe's billing —
it would create silent price drift, discovered only when a customer disputes an
invoice. Plans render read-only with a "Manage in Stripe" link.

---

## Architecture

### Shell & routing

Admin currently lives at `src/app/[locale]/(app)/admin/**`, so it inherits the
app's `AppNav` + `MobileTabBar`. The mock shows a distinct shell with its own top
bar and a "To app →" exit.

**Move `(app)/admin/**` → `(admin)/admin/**`.** Route groups do not appear in the
URL, so `/de/admin` is unchanged, but admin escapes the app shell.

- `(admin)/layout.tsx` — the auth gate (unchanged logic: `getProfile()`, redirect
  non-admins to `/home`) wrapping a new `<AdminShell>`.
- `AdminShell` — sidebar + top bar (locale switcher, theme toggle, "To app →",
  admin identity). No app nav, no mobile tab bar.
- `src/components/admin-tabs.tsx` is deleted (replaced by the sidebar).

Server actions keep their own admin re-check (defense in depth) — unchanged.

### Sidebar IA

The mock's own eyebrow labels (OVERVIEW / MANAGEMENT / MONETIZATION /
MARKETPLACE) imply grouping. Sections:

```
OVERVIEW      Overview
MARKETPLACE   Briefs · Users
MONETIZATION  Pricing
MODERATION    Reports · Verifications · Disputes
SYSTEM        Audit · Email
```

Moderation entries carry an urgency dot when their open count > 0 (the existing
"needs attention" signal, promoted into the nav).

### Data layer

`src/lib/admin/metrics.ts` — queries via service role; pure helpers extracted so
they are unit-testable without a DB.

**MRR** (pure, testable):

```
computeMrrChf(subs) = Σ PRICE_CHF_MONTHLY[plan]
  over subs where source = 'stripe' AND status ∈ (active, trialing, past_due)
```

Comps are excluded structurally: the schema's `subscriptions_source_shape` check
guarantees `source='admin_comp'` ⟺ `status='comp'`, so filtering on
`source='stripe'` drops every comped account. Comped users are counted separately
and shown as their own figure — they are real users but CHF 0 revenue.

`past_due` counts toward MRR because those users retain entitlement during
Stripe's dunning window (`ENTITLED_STRIPE_STATUSES`).

**Plan distribution** reads `photographer_effective_tier` — the single tier source
(expired → free). Never `photographer_details.plan_tier` directly.

### Revenue history

New migration: `revenue_monthly`

| column | type | note |
|---|---|---|
| `month` | `date` PK | first day of the month, Europe/Zurich |
| `mrr_chf` | `integer` | computed MRR at capture |
| `paying_users` | `integer` | source='stripe', entitled |
| `comped_users` | `integer` | source='admin_comp', unexpired |
| `free_count`, `basic_count`, `standard_count`, `premium_count` | `integer` | from the effective-tier view |
| `captured_at` | `timestamptz` | last write for this month |

RLS: no anon/authenticated grants — admin reads through the service role, matching
every other admin surface.

**Writer:** hooked into the existing `/api/cron/process` (every 5 min). It upserts
the *current* month's row on each run, so the value is always fresh and the write
is idempotent and self-healing after downtime. No new cron entry — the Hobby plan
caps cron count.

History starts accruing from deploy. The chart renders only months that exist;
it never back-fills or fabricates. Since Stripe is not live yet, early months are
legitimately CHF 0 and must display as such.

### Activity feed

`audit_log` alone is insufficient — it records admin actions, while the mock's feed
shows signups, upgrades, new briefs, and verification requests.

New SECURITY DEFINER RPC `admin_recent_activity(limit int)`, admin-gated, returning
a UNION ALL over:

| kind | source |
|---|---|
| `signup` | `profiles.created_at` |
| `subscription` | `subscriptions.updated_at` (plan + status) |
| `brief` | `shoots.created_at` |
| `report` | `reports.created_at` |
| `verification` | `photographer_details` where status = pending |

Shape: `(kind, actor_id, actor_name, target_label, meta jsonb, created_at)`,
ordered `created_at DESC`, limited. The page polls on an interval — the mock's
"LIVE" badge becomes a periodic refresh. Realtime is not worth a subscription
here.

### Charts

**No charting library.** Sparklines are an SVG `polyline`; the revenue chart is
SVG `rect`s; plan distribution is CSS bars. This matches the Atelier line-art
aesthetic and keeps the bundle lean. Follow the `dataviz` skill for palette and
accessibility (never color alone; every series labelled).

---

## Pages

### Overview
KPI row: Total users · Clients · Photographers · MRR — each with a 30-day delta
and a sparkline. Range switcher (7T / 30T / 12M) drives the KPI window.
Revenue chart (from `revenue_monthly`) beside plan distribution. Recent activity
below. The existing "needs attention" counts move into the sidebar as urgency dots.

### Briefs (new)
Shoots table: title · client · budget · offer count · status · date. Read-only,
each row links to the shoot. Server-side pagination, newest first, status filter.

### Users
Function unchanged; restyled to the mock: avatar, name + email, role, plan badge
(from the effective-tier view), status, city, joined, and **MRR contribution**
replacing the mock's fabricated "spend". Search + All/Photographers/Clients tabs.

### Pricing
Read-only cards from `PLAN_FEATURE_MATRIX`: price, feature count, live user count,
MRR share. Header stats: active plans, paying users, computed MRR. "Manage in
Stripe" link. Comp management (existing `grantComp`/`revokeComp`) surfaces here.

### Reports · Verifications · Disputes · Audit · Email
Restyled into the new shell. **No functional change.**

---

## Mobile

Admin is an internal operator tool, so the bar is **usable, not identical**:

- Sidebar → drawer behind a hamburger.
- Wide tables scroll horizontally **inside their own container** — the page body
  never scrolls sideways.
- Overview KPIs stack; charts stay readable at 390px.
- Time-critical actions (approving a verification, actioning a report) must work
  on a phone.
- Audit and Email may degrade to a horizontally scrolling table.

## i18n

Every new string lands in `de`/`fr`/`en`. Key parity is a gate (`826` keys ×3
today). Plan display names come from the existing `billing.plan.*.name` keys —
never hardcoded.

---

## Verification (every sprint)

- `npm run typecheck` · `npm run lint` (0 errors) · `npx vitest run`
- `npm run db:test` (pgTAP) — **run `npm run db:reset` first if a migration is new;
  `supabase test db` does not apply pending migrations**
- `npm run build` · i18n key parity de/fr/en
- Browser pass at 1440 and 390, light + dark
- New unit tests: `computeMrrChf` (comp excluded, `past_due` included, empty set),
  rollup upsert idempotency, activity ordering
- New pgTAP: `revenue_monthly` denies anon/authenticated; `admin_recent_activity`
  is admin-only
- Playwright: admin sidebar nav, Briefs page, non-admin redirect to `/home`

---

## Sprint decomposition

### Sprint 1 — Shell & IA
Move to the `(admin)` route group; build `AdminShell` (sidebar sections, top bar,
mobile drawer); restyle the 7 existing pages; delete `admin-tabs.tsx`.
**No new data, no migrations.** Exit: every existing admin function works
unchanged, both viewports.

### Sprint 2 — Overview & revenue
`src/lib/admin/metrics.ts` + `computeMrrChf`; `revenue_monthly` migration + RLS +
pgTAP; rollup in `/api/cron/process`; plan distribution; SVG sparkline + bar
chart; Overview page with the range switcher.
Exit: MRR matches a hand-computed figure from seeded subscriptions.

### Sprint 3 — Marketplace & activity
Briefs page; `admin_recent_activity` RPC + polling feed; Pricing page (read-only +
comp); Users table restyle with plan badge + MRR contribution.
Exit: full visual regression across all 9 admin pages, both viewports.

---

## Owner actions (outside this work)

- Stripe keys are still unset, so MRR reads CHF 0 until the six `STRIPE_PRICE_*`
  vars, the webhook, and the Portal are configured. This is expected, not a bug.
- `revenue_monthly` only accrues from deploy forward. Deploying Sprint 2 sooner
  means more history later.
