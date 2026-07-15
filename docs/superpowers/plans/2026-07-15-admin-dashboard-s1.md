# Admin Dashboard — Sprint 1 (Shell & IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/admin` its own editorial shell — a sectioned sidebar and top bar — without changing a single admin function or touching any data.

**Architecture:** Admin moves from the `(app)` route group into a new `(admin)` route group. Route groups are invisible in the URL, so `/de/admin` is unchanged (and the middleware gate at `src/lib/supabase/middleware.ts:17` keeps working), but admin stops inheriting `AppNav` + `MobileTabBar` and gets `AdminShell` instead. The 7 existing pages keep their logic; only their chrome changes.

**Tech Stack:** Next.js 16 App Router (RSC), next-intl, Tailwind v4, Supabase service role for counts.

**Spec:** `docs/superpowers/specs/2026-07-15-admin-dashboard-design.md`

## Global Constraints

- Plans are `free | basic | standard | premium` at CHF 0/59/119/229. The mock's Studio/Atelier/Agency names and 29/79/199 prices are **placeholder art — never use them**.
- Every user-visible string is an i18n key in `de` + `fr` + `en`. Key parity across the three files is a gate (826 keys each today).
- Mobile bar for admin: **usable, not identical**. Wide tables scroll inside their own `overflow-x-auto` container; the page body never scrolls sideways.
- No new npm dependency. No charting library.
- Design tokens only: `ink`, `paper`, `surface`, `line`, `line-strong`, `mute`, `mute-2`, `accent`, `chip`. No raw hex.
- Touch targets ≥ 44px.
- **No functional change to any admin page in this sprint.** `e2e/admin-flow.spec.ts` must stay green at every commit.
- Admin auth is defense-in-depth: the layout gate is UX only; server actions keep their own `is_admin` re-check. Do not remove either.

---

### Task 1: Move admin into its own route group

Structural only — no visual change. The existing e2e spec is the proof nothing broke.

**Files:**
- Create: `src/app/[locale]/(admin)/layout.tsx`
- Move: `src/app/[locale]/(app)/admin/**` → `src/app/[locale]/(admin)/admin/**`
- Delete: `src/app/[locale]/(admin)/admin/layout.tsx` (its gate moves up into the group layout)
- Test: `e2e/admin-flow.spec.ts` (existing — regression gate)

**Interfaces:**
- Consumes: `getProfile()` from `@/lib/auth`, `redirect` from `@/i18n/navigation`
- Produces: the `(admin)` route group. Later tasks put `AdminShell` inside `(admin)/layout.tsx`.

- [ ] **Step 1: Confirm the e2e admin spec passes BEFORE the move**

Run: `npx playwright test e2e/admin-flow.spec.ts`
Expected: PASS. If it already fails, stop — fix or report first; you need a trustworthy baseline.

- [ ] **Step 2: Move the directory with git mv (preserves history)**

```bash
mkdir -p "src/app/[locale]/(admin)"
git mv "src/app/[locale]/(app)/admin" "src/app/[locale]/(admin)/admin"
```

- [ ] **Step 3: Create the group layout with the gate**

Create `src/app/[locale]/(admin)/layout.tsx`. This is the old `admin/layout.tsx` **verbatim** — gate, `<h1>`, and `<AdminTabs>` all kept.

**Do not drop the `<h1>` or `<AdminTabs>` in this task.** `e2e/admin-flow.spec.ts` asserts `getByRole("heading", { name: "Admin" })` (that `<h1>`) and clicks `getByRole("link", { name: "Nutzer:innen" })` (an `AdminTabs` link). Removing either here turns this structural move into a red test, and you lose the signal that tells you the move itself was safe. Task 2 swaps the tabs for the sidebar (same link label), and Task 6 retires the `<h1>`.

```tsx
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { AdminTabs } from "@/components/admin-tabs";

export const dynamic = "force-dynamic";

// Central admin gate for every /admin/* route. Individual server actions also
// re-check admin (defense-in-depth), so this is the UX gate, not the only one.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (!profile.is_admin) {
    redirect({ href: "/home", locale });
    return null;
  }

  const t = await getTranslations("admin");

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-10 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete the now-duplicated inner layout**

```bash
rm "src/app/[locale]/(admin)/admin/layout.tsx"
```

- [ ] **Step 5: Verify the gate and the pages**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors.

Run: `npx playwright test e2e/admin-flow.spec.ts`
Expected: PASS — same as the Step 1 baseline. This proves the URL, the middleware gate, and the non-admin redirect all survived the move.

- [ ] **Step 6: Commit**

```bash
git add -A "src/app/[locale]"
git commit -m "refactor(admin): move admin into its own (admin) route group

Route groups are invisible in the URL, so /de/admin is unchanged and the
middleware private-path gate still matches. Admin now stops inheriting the
app nav and mobile tab bar, making room for a dedicated shell."
```

---

### Task 2: AdminShell sidebar with sections

**Files:**
- Create: `src/components/admin-sidebar.tsx`
- Modify: `src/app/[locale]/(admin)/layout.tsx`
- Modify: `src/i18n/messages/de.json`, `fr.json`, `en.json` (`admin` namespace)

**Interfaces:**
- Consumes: `usePathname`, `Link` from `@/i18n/navigation`; `useTranslations` from `next-intl`
- Produces: `<AdminSidebar />` (client component, no props in this task — Task 5 adds `counts`). `ADMIN_NAV` is exported for reuse by Task 4's drawer.

- [ ] **Step 1: Add the i18n keys**

The `admin` namespace already has `tabDashboard`, `tabUsers`, `tabVerifications`, `tabReports`, `tabDisputes`, `tabAudit`, `tabEmail`. Add only the section labels and the new Briefs/Pricing entries (their pages arrive in Sprint 3; the nav entries are added then, not now — so only section labels here).

In `src/i18n/messages/de.json`, inside `"admin"`:

```json
"sectionOverview": "Übersicht",
"sectionMarketplace": "Marktplatz",
"sectionMonetization": "Monetarisierung",
"sectionModeration": "Moderation",
"sectionSystem": "System",
"sidebarAria": "Admin-Navigation",
"toApp": "Zur App"
```

In `src/i18n/messages/fr.json`, inside `"admin"`:

```json
"sectionOverview": "Aperçu",
"sectionMarketplace": "Marché",
"sectionMonetization": "Monétisation",
"sectionModeration": "Modération",
"sectionSystem": "Système",
"sidebarAria": "Navigation admin",
"toApp": "Vers l'app"
```

In `src/i18n/messages/en.json`, inside `"admin"`:

```json
"sectionOverview": "Overview",
"sectionMarketplace": "Marketplace",
"sectionMonetization": "Monetization",
"sectionModeration": "Moderation",
"sectionSystem": "System",
"sidebarAria": "Admin navigation",
"toApp": "To app"
```

- [ ] **Step 2: Verify i18n key parity fails-safe**

Run:
```bash
node -e "const d=require('./src/i18n/messages/de.json'),f=require('./src/i18n/messages/fr.json'),e=require('./src/i18n/messages/en.json');const k=o=>{const s=[];const w=(x,p='')=>Object.entries(x).forEach(([a,b])=>typeof b==='object'&&b?w(b,p+a+'.'):s.push(p+a));w(o);return s.sort()};const kd=k(d),kf=k(f),ke=k(e);const ok=JSON.stringify(kd)===JSON.stringify(kf)&&JSON.stringify(kd)===JSON.stringify(ke);console.log('de',kd.length,'fr',kf.length,'en',ke.length,'parity:',ok);process.exit(ok?0:1)"
```
Expected: `de 833 fr 833 en 833 parity: true`, exit 0.

- [ ] **Step 3: Write the sidebar**

Create `src/components/admin-sidebar.tsx`. Sections mirror the mock's own eyebrow labels. Pricing and Briefs are deliberately absent — their pages do not exist until Sprint 3, and a nav link to a 404 is a bug.

```tsx
"use client";

import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";

/**
 * Admin navigation, grouped the way the design's own eyebrow labels imply.
 * Exported so the mobile drawer renders the same tree without duplicating it.
 * Entries are added only when their page exists — a nav link to a 404 is a bug.
 */
export const ADMIN_NAV = [
  {
    sectionKey: "sectionOverview",
    items: [{ href: "/admin", labelKey: "tabDashboard" }],
  },
  {
    sectionKey: "sectionMarketplace",
    items: [{ href: "/admin/users", labelKey: "tabUsers" }],
  },
  {
    sectionKey: "sectionModeration",
    items: [
      { href: "/admin/reports", labelKey: "tabReports" },
      { href: "/admin/verifications", labelKey: "tabVerifications" },
      { href: "/admin/disputes", labelKey: "tabDisputes" },
    ],
  },
  {
    sectionKey: "sectionSystem",
    items: [
      { href: "/admin/audit", labelKey: "tabAudit" },
      { href: "/admin/email", labelKey: "tabEmail" },
    ],
  },
] as const;

export function AdminSidebar() {
  const t = useTranslations("admin");
  const pathname = usePathname(); // locale-stripped, e.g. "/admin/users"

  return (
    <nav aria-label={t("sidebarAria")} className="space-y-7">
      {ADMIN_NAV.map((section) => (
        <div key={section.sectionKey}>
          <p className="label mb-2 px-3 text-mute-2">{t(section.sectionKey)}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              // Exact match only: "/admin" must not light up on "/admin/users".
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-testid={`admin-nav-${item.href.split("/").pop()}`}
                    className={`flex min-h-11 items-center border-l-2 px-3 text-[15px] transition-colors ${
                      active
                        ? "border-ink bg-surface font-medium text-ink"
                        : "border-transparent text-mute hover:text-ink"
                    }`}
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Mount it in the layout, retiring the tab bar**

Replace the body of `src/app/[locale]/(admin)/layout.tsx`'s returned JSX (keep the gate above it exactly as-is). The `<h1>` **stays** for now — `e2e/admin-flow.spec.ts` asserts it, and Task 6 is where it is replaced by per-page headers. `AdminTabs` goes: the sidebar carries the same `tabUsers` label ("Nutzer:innen"), so the spec's link click still resolves.

```tsx
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-line px-4 py-8 lg:block">
        <AdminSidebar />
      </aside>
      <main id="main" className="min-w-0 space-y-8 px-5 py-8 sm:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h1>
        {children}
      </main>
    </div>
  );
```

Swap the import: drop `AdminTabs`, add

```tsx
import { AdminSidebar } from "@/components/admin-sidebar";
```

Do **not** delete `src/components/admin-tabs.tsx` yet — Task 6 removes it once nothing imports it.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors.

Run: `npx playwright test e2e/admin-flow.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin-sidebar.tsx "src/app/[locale]/(admin)/layout.tsx" src/i18n/messages
git commit -m "feat(admin): sectioned sidebar shell

Sections follow the design's own eyebrow labels (Overview / Marketplace /
Moderation / System). Pricing and Briefs are omitted until their pages exist
in Sprint 3."
```

---

### Task 3: Admin top bar

**Files:**
- Create: `src/components/admin-topbar.tsx`
- Modify: `src/app/[locale]/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `LocaleSwitcher` from `@/components/locale-switcher`, `ThemeToggle` from `@/components/theme-toggle`, `Link` from `@/i18n/navigation`
- Produces: `<AdminTopbar displayName={string} />` — a server-rendered bar; the switcher/toggle inside are already client components.

- [ ] **Step 1: Write the top bar**

Create `src/components/admin-topbar.tsx`. The mock's global search box is intentionally omitted — admin search is out of scope per the spec.

```tsx
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export async function AdminTopbar({ displayName }: { displayName: string }) {
  const t = await getTranslations("admin");

  return (
    <header className="flex items-center gap-4 border-b border-line px-5 py-3 sm:px-8">
      <span className="label text-mute-2">{t("badgeAdmin")}</span>
      <div className="ml-auto flex items-center gap-3">
        <LocaleSwitcher />
        <ThemeToggle />
        <Link
          href="/home"
          className="press flex min-h-11 items-center border border-line px-4 text-[13px] text-ink transition-colors hover:border-ink"
        >
          {t("toApp")} →
        </Link>
        <span className="hidden text-[13px] text-mute sm:inline">
          {displayName}
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Check the two imported components' real prop signatures**

Run: `grep -nE "export function (LocaleSwitcher|ThemeToggle)" -A 3 src/components/locale-switcher.tsx src/components/theme-toggle.tsx`
Expected: both take no required props. If either requires props, pass them from the layout's `profile`/`locale` — do not guess.

- [ ] **Step 3: Mount it**

In `src/app/[locale]/(admin)/layout.tsx`, wrap the main column so the bar sits above the content:

```tsx
      <div className="flex min-w-0 flex-col">
        <AdminTopbar displayName={profile.display_name ?? ""} />
        <main id="main" className="min-w-0 px-5 py-8 sm:px-8">
          {children}
        </main>
      </div>
```

Add the import:

```tsx
import { AdminTopbar } from "@/components/admin-topbar";
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: 0 errors, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin-topbar.tsx "src/app/[locale]/(admin)/layout.tsx"
git commit -m "feat(admin): top bar with locale, theme and back-to-app"
```

---

### Task 4: Mobile drawer

The sidebar is `hidden lg:block` after Task 2, so on a phone the admin currently has **no navigation at all**. This task is what makes the sprint shippable on mobile.

**Files:**
- Create: `src/components/admin-drawer.tsx`
- Modify: `src/app/[locale]/(admin)/layout.tsx`
- Test: `e2e/admin-flow.spec.ts` (add a 390px nav case)

**Interfaces:**
- Consumes: `ADMIN_NAV` + `AdminSidebar` from `@/components/admin-sidebar`
- Produces: `<AdminDrawer />` — a client component rendering a hamburger + slide-over containing `<AdminSidebar />`.

- [ ] **Step 1: Write the failing e2e test**

Add to `e2e/admin-flow.spec.ts`:

Add it inside the existing `test.describe("admin console", ...)` block, which already imports `{ SEED, login }` from `./helpers`:

```ts
test("admin navigation is reachable on a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, SEED.admin.email, SEED.admin.password);
  await page.goto("/de/admin");

  // The desktop rail is hidden on mobile; the drawer is the only way through.
  await page.getByTestId("admin-drawer-open").click();
  await page.getByTestId("admin-nav-users").click();

  await expect(page).toHaveURL(/\/admin\/users$/);
  // The page must not scroll sideways at 390.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
```

`SEED.admin` is `admin@rintakez.ch` — a seed.sql row, so it survives `db:reset`. Do not substitute `fotograf@test.ch`: that one is created by `scripts/seed-test-accounts.mjs` and is absent on a fresh CI database.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test e2e/admin-flow.spec.ts -g "390px"`
Expected: FAIL — no element with testid `admin-drawer-open`.

- [ ] **Step 3: Write the drawer**

Create `src/components/admin-drawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { AdminSidebar } from "@/components/admin-sidebar";

export function AdminDrawer() {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation — the drawer would otherwise stay over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape, the expected affordance for a slide-over.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        data-testid="admin-drawer-open"
        aria-expanded={open}
        aria-label={t("sidebarAria")}
        onClick={() => setOpen(true)}
        className="press flex h-11 w-11 items-center justify-center border border-line text-ink"
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-backdrop"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] overflow-y-auto border-r border-line bg-paper px-4 py-8">
            <AdminSidebar />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the `close` i18n key if it is missing**

Run: `node -e "const d=require('./src/i18n/messages/de.json');console.log('admin.close =', d.admin.close)"`

If it prints `undefined`, add `"close"` to the `admin` namespace in all three files: de `"Schliessen"`, fr `"Fermer"`, en `"Close"`. Then re-run the parity check from Task 2 Step 2 and expect exit 0.

- [ ] **Step 5: Mount it in the top bar row**

In `src/app/[locale]/(admin)/layout.tsx`, render `<AdminDrawer />` as the first child of the header row. The cleanest seam: pass it into `AdminTopbar` as a leading slot. Modify `admin-topbar.tsx`'s signature to:

```tsx
export async function AdminTopbar({
  displayName,
  leading,
}: {
  displayName: string;
  leading?: React.ReactNode;
}) {
```

and render `{leading}` as the first child inside `<header>`, before the admin badge. Then in the layout:

```tsx
<AdminTopbar displayName={profile.display_name ?? ""} leading={<AdminDrawer />} />
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx playwright test e2e/admin-flow.spec.ts`
Expected: PASS, including the new 390px case.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin-drawer.tsx src/components/admin-topbar.tsx "src/app/[locale]/(admin)/layout.tsx" e2e/admin-flow.spec.ts src/i18n/messages
git commit -m "feat(admin): mobile drawer navigation

The desktop rail is lg-only, so without this the admin has no nav on a phone.
Covered by a 390px e2e case that also asserts the body never scrolls sideways."
```

---

### Task 5: Sidebar urgency dots

The overview's "needs attention" counts become an always-visible signal in the nav, so an admin sees pending work from any page.

**Files:**
- Create: `src/lib/admin/counts.ts`
- Modify: `src/components/admin-sidebar.tsx`, `src/app/[locale]/(admin)/layout.tsx`
- Test: `src/lib/admin/counts.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin`
- Produces:
  - `export type AdminCounts = { reports: number; verifications: number; disputes: number; email: number }`
  - `export async function fetchAdminCounts(): Promise<AdminCounts>`
  - `<AdminSidebar counts={AdminCounts} />` — `counts` is required from this task on.

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin/counts.test.ts`. Test the pure mapper, not the network:

```ts
import { describe, expect, it } from "vitest";
import { toAdminCounts } from "./counts";

describe("toAdminCounts", () => {
  it("maps head-count results to a flat count object", () => {
    expect(
      toAdminCounts({
        reports: { count: 3 },
        verifications: { count: 0 },
        disputes: { count: 1 },
        email: { count: 7 },
      })
    ).toEqual({ reports: 3, verifications: 0, disputes: 1, email: 7 });
  });

  it("treats a null count as zero rather than rendering an empty dot", () => {
    expect(
      toAdminCounts({
        reports: { count: null },
        verifications: { count: null },
        disputes: { count: null },
        email: { count: null },
      })
    ).toEqual({ reports: 0, verifications: 0, disputes: 0, email: 0 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/admin/counts.test.ts`
Expected: FAIL — cannot resolve `./counts`.

- [ ] **Step 3: Implement**

Create `src/lib/admin/counts.ts`:

```ts
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminCounts = {
  reports: number;
  verifications: number;
  disputes: number;
  email: number;
};

type HeadResult = { count: number | null };

/**
 * Pure mapper over Supabase head-count results. Split from the query so the
 * null-to-zero rule is testable without a database.
 */
export function toAdminCounts(r: {
  reports: HeadResult;
  verifications: HeadResult;
  disputes: HeadResult;
  email: HeadResult;
}): AdminCounts {
  return {
    reports: r.reports.count ?? 0,
    verifications: r.verifications.count ?? 0,
    disputes: r.disputes.count ?? 0,
    email: r.email.count ?? 0,
  };
}

/** Open work per moderation/system area, for the sidebar urgency dots. */
export async function fetchAdminCounts(): Promise<AdminCounts> {
  const admin = createAdminClient();
  if (!admin) return { reports: 0, verifications: 0, disputes: 0, email: 0 };

  const head = { count: "exact" as const, head: true };
  const [reports, verifications, disputes, email] = await Promise.all([
    admin.from("reports").select("id", head).eq("status", "open"),
    admin
      .from("photographer_details")
      .select("profile_id", head)
      .eq("verification_status", "pending"),
    admin.from("disputes").select("id", head).eq("status", "open"),
    admin.from("email_outbox").select("id", head).eq("status", "failed"),
  ]);

  return toAdminCounts({ reports, verifications, disputes, email });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/admin/counts.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Render the dots**

In `src/components/admin-sidebar.tsx`:

- import the type: `import type { AdminCounts } from "@/lib/admin/counts";`
- change the signature to `export function AdminSidebar({ counts }: { counts: AdminCounts })`
- add a count key to the nav entries that have one, by extending the `ADMIN_NAV` items for reports/verifications/disputes/email with `countKey: "reports" | "verifications" | "disputes" | "email"`.

Inside the `<Link>`, after `{t(item.labelKey)}`, render:

```tsx
{"countKey" in item && counts[item.countKey] > 0 && (
  <span
    data-testid={`admin-nav-dot-${item.countKey}`}
    aria-label={String(counts[item.countKey])}
    className="ml-auto h-1.5 w-1.5 shrink-0 bg-accent"
  />
)}
```

The dot is `aria-label`led with the number because color alone must never carry meaning.

- [ ] **Step 6: Pass counts from the layout and the drawer**

In `src/app/[locale]/(admin)/layout.tsx`, add `const counts = await fetchAdminCounts();` after the gate, and pass `counts` to `<AdminSidebar counts={counts} />`.

`AdminDrawer` is a client component and cannot fetch — give it a `counts` prop and forward it:

```tsx
export function AdminDrawer({ counts }: { counts: AdminCounts }) {
```
and inside, `<AdminSidebar counts={counts} />`. Then in the layout: `leading={<AdminDrawer counts={counts} />}`.

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npx vitest run && npx playwright test e2e/admin-flow.spec.ts`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin "src/app/[locale]/(admin)/layout.tsx" src/components/admin-sidebar.tsx src/components/admin-drawer.tsx
git commit -m "feat(admin): urgency dots on moderation nav entries

Open reports/verifications/disputes/failed-emails are visible from any admin
page, not just the overview. The dot carries an aria-label with the count —
colour alone never carries meaning."
```

---

### Task 6: Page headers + wide-table containment

Each page gets the mock's eyebrow + title treatment (the group layout no longer renders a global `<h1>`), and every wide table gets a scroll container so mobile works.

**Files:**
- Create: `src/components/admin-page-header.tsx`
- Modify: all 7 pages under `src/app/[locale]/(admin)/admin/`
- Modify: `src/i18n/messages/{de,fr,en}.json`
- Delete: `src/components/admin-tabs.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `<AdminPageHeader eyebrow={string} title={string} action?={React.ReactNode} />`

- [ ] **Step 1: Write the header component**

Create `src/components/admin-page-header.tsx`:

```tsx
export function AdminPageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="label text-mute-2">{eyebrow}</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Add the eyebrow i18n keys**

Add to the `admin` namespace in all three files. de: `"eyebrowOverview": "Übersicht"`, `"eyebrowManagement": "Verwaltung"`, `"eyebrowModeration": "Moderation"`, `"eyebrowSystem": "System"`. fr: `"Aperçu"`, `"Gestion"`, `"Modération"`, `"Système"`. en: `"Overview"`, `"Management"`, `"Moderation"`, `"System"`.

Re-run the parity check from Task 2 Step 2. Expected: exit 0.

- [ ] **Step 3: Retire the layout `<h1>` and apply per-page headers**

First remove the `<h1>{t("title")}</h1>` from `src/app/[locale]/(admin)/layout.tsx` (and the now-unused `getTranslations` import if nothing else uses `t` there).

This is safe for `e2e/admin-flow.spec.ts` only because the per-page headers below preserve the two headings it asserts: the overview's title key is `title` → renders "Admin", and the audit page's is `tabAudit` → "Audit-Log". `getByRole("heading")` matches any level, so the existing `<h2>` becoming an `<h1>` is fine. **Keep those two title keys exactly as the table says** or the spec goes red.

For each of the 7 pages, add the header as the first child of the returned JSX and replace the page's existing local `<h2>` (audit and users have one at `page.tsx:33` / `:74`; check each page):

| page | eyebrow key | title key |
|---|---|---|
| `admin/page.tsx` | `eyebrowOverview` | `title` |
| `admin/users/page.tsx` | `eyebrowManagement` | `tabUsers` |
| `admin/reports/page.tsx` | `eyebrowModeration` | `tabReports` |
| `admin/verifications/page.tsx` | `eyebrowModeration` | `tabVerifications` |
| `admin/disputes/page.tsx` | `eyebrowModeration` | `tabDisputes` |
| `admin/audit/page.tsx` | `eyebrowSystem` | `tabAudit` |
| `admin/email/page.tsx` | `eyebrowSystem` | `tabEmail` |

Example for `admin/users/page.tsx` (these are async server components, so `t` comes from `getTranslations("admin")` which the page already has):

```tsx
<AdminPageHeader eyebrow={t("eyebrowManagement")} title={t("tabUsers")} />
```

- [ ] **Step 4: Contain every wide table**

Search for tables: `grep -rln "<table" "src/app/[locale]/(admin)" src/components/admin-*.tsx`

Wrap each `<table>` in:

```tsx
<div className="overflow-x-auto">
  <table className="w-full min-w-[720px]">
```

This is what keeps the page body from scrolling sideways at 390px while the table itself stays readable.

- [ ] **Step 5: Delete the dead tab bar**

```bash
rm src/components/admin-tabs.tsx
```

Run: `grep -rn "admin-tabs\|AdminTabs" src/ || echo "no references"`
Expected: `no references`. If any remain, remove them.

- [ ] **Step 6: Verify everything**

Run:
```bash
npm run typecheck && npm run lint && npx vitest run && npm run build && npx playwright test e2e/admin-flow.spec.ts
```
Expected: all green, 0 lint errors.

- [ ] **Step 7: Visual pass — both viewports, both themes**

Start the dev server (`rm -rf .next` first if a prod build ran — stale `.next` breaks `next dev`), log in as `fotograf@test.ch` / `test1234` (admin; run `node scripts/seed-test-accounts.mjs` if the account is missing after a db reset), and check all 7 pages at 1440 and 390, light and dark:

- sidebar sections render, active state is exact (`/admin` does not light up on `/admin/users`)
- drawer opens and navigates at 390
- no horizontal body scroll on any page at 390
- urgency dots appear only where the count > 0

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat(admin): editorial page headers; contain wide tables on mobile

Each page carries the design's eyebrow + title. Wide tables scroll inside
their own container so the body never scrolls sideways at 390px. The old
tab bar is deleted — the sidebar replaces it."
```

---

## Sprint 1 exit criteria

- All 7 admin pages work exactly as before — `e2e/admin-flow.spec.ts` green, including the new 390px case.
- `npm run typecheck` ✓ · `npm run lint` 0 errors ✓ · `npx vitest run` ✓ · `npm run build` ✓ · i18n parity ✓
- No migration, no server-action change, no data change in this sprint.
- Visual pass done at 1440 + 390, light + dark.
- Then: whole-branch review before Sprint 2 (`docs/superpowers/plans/2026-07-15-admin-dashboard-s2.md`, written after this ships).
