# Rintakez Plan 2: Auth & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Email/password authentication, role-aware registration, an authenticated app shell with route protection, and photographer onboarding (details + portfolio upload) — spec phase 3.

**Architecture:** Supabase Auth (email/password; Google OAuth deferred to launch config) via `@supabase/ssr`. Server Actions for all mutations, Zod-validated. Middleware gates an `(app)` route group. Onboarding writes `photographer_details` and uploads to the `portfolio` Storage bucket. RLS (already shipped) is the security boundary; these forms are UX over it.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod, react-hook-form, @supabase/ssr, next-intl, Tailwind theme tokens.

**Builds on:** Plan 1 (v0.1.0-foundation). Schema, RLS, `handle_new_user` trigger (reads `role`/`display_name`/`locale` from signup metadata), storage buckets + own-folder policies all exist.

**Branch:** `feat/plan-2-auth`.

---

## Conventions for this plan

- **Locale-aware links/redirects:** use `Link`/`redirect` from `@/i18n/navigation`, never bare `next/navigation` for user-facing navigation (keeps the `/de|/fr|/en` prefix).
- **Server Actions** live in `src/lib/actions/*.ts`, marked `"use server"`, return `{ ok: true } | { ok: false; error: string }` (never throw to the client).
- **Zod schemas** live in `src/lib/validation/*.ts`, imported by both the form and the action.
- **New translation keys:** add to all three of `src/i18n/messages/{de,fr,en}.json` in the same step; keep keys symmetric.

---

## Task 1: Generated DB types (typed Supabase client)

**Files:** Create `src/lib/supabase/database.types.ts`; modify `client.ts`, `server.ts`, `middleware.ts`, `package.json`.

The local Supabase CLI in this environment requires `supabase login` for `gen types`. If a `SUPABASE_ACCESS_TOKEN` is available or the user has logged in, generate from the DB; otherwise hand-author the types from the migrations (they are the source of truth).

- [ ] **Step 1: Add npm script** to `package.json` scripts:

```json
"db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"
```

- [ ] **Step 2: Produce `src/lib/supabase/database.types.ts`.** Try `npm run db:types`. If it fails with an auth error, hand-author the file to match `supabase/migrations/*` — it must export a `Database` type with `public.Tables` for `profiles`, `photographer_details`, `portfolio_images`, `shoots`, `bids` (Row/Insert/Update), `public.Enums` for `user_role`, `locale`, `canton`, `shoot_type`, `shoot_status`, `bid_status`, and `public.Functions` for `accept_bid`, `get_counterparty_email`, `shoot_bid_count`. Use the exact column types from the schema migration (e.g. `canton: Database["public"]["Enums"]["canton"] | null`). Keep it minimal but accurate.

- [ ] **Step 3: Type the three clients.** In `client.ts`, `server.ts`, `middleware.ts`, import `Database` and parameterize: `createBrowserClient<Database>(...)`, `createServerClient<Database>(...)`. No behavior change.

- [ ] **Step 4: Verify** — `npm run typecheck` green; update `src/app/[locale]/page.tsx` to drop the `as ShootCardData` cast where the typed client now infers it (keep `ShootCardData` as the component prop type; the query result should now be assignable). If a residual mismatch remains, keep a narrow mapping rather than a blanket cast. `npm run build`, `npx vitest run` green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: typed Supabase client from generated Database types"`.

---

## Task 2: Auth helper — current user/profile accessor

**Files:** Create `src/lib/auth.ts`; Test `src/lib/auth.test.ts` (pure helper only).

A small server-side helper used by layouts and actions to fetch the signed-in user and their profile.

- [ ] **Step 1: Write `src/lib/auth.ts`:**

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, role, display_name, avatar_url, city, canton, locale")
    .eq("id", user.id)
    .single();
  return data;
});
```

- [ ] **Step 2: Verify** typecheck + build green. (No unit test — these are thin IO wrappers; they're covered by E2E later.) Commit: `git commit -m "feat: server-side session user/profile accessors"`.

---

## Task 3: Validation schemas + auth Server Actions

**Files:** Create `src/lib/validation/auth.ts`, `src/lib/actions/auth.ts`; Test `src/lib/validation/auth.test.ts`.

- [ ] **Step 1: Write the failing test** `src/lib/validation/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts a valid client registration", () => {
    const r = registerSchema.safeParse({
      email: "a@b.ch",
      password: "password123",
      displayName: "Lena K.",
      role: "client",
      locale: "de",
    });
    expect(r.success).toBe(true);
  });
  it("rejects a short password", () => {
    const r = registerSchema.safeParse({
      email: "a@b.ch",
      password: "short",
      displayName: "Lena K.",
      role: "client",
      locale: "de",
    });
    expect(r.success).toBe(false);
  });
  it("rejects an invalid role", () => {
    const r = registerSchema.safeParse({
      email: "a@b.ch",
      password: "password123",
      displayName: "Lena K.",
      role: "admin",
      locale: "de",
    });
    expect(r.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.ch", password: "password123" }).success
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run `npx vitest run`** → FAIL (module missing).

- [ ] **Step 3: Implement `src/lib/validation/auth.ts`:**

```ts
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  displayName: z.string().min(2).max(80),
  role: z.enum(["client", "photographer"]),
  locale: z.enum(["de", "fr", "en"]),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
```

Install zod first if absent: `npm install zod`.

- [ ] **Step 4: Run `npx vitest run`** → all pass.

- [ ] **Step 5: Implement `src/lib/actions/auth.ts`:**

```ts
"use server";

import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function registerAction(
  raw: unknown
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const { email, password, displayName, role, locale } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role, locale },
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loginAction(raw: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_input" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect({ href: "/", locale });
}
```

- [ ] **Step 6:** typecheck + build + vitest green. Commit: `git commit -m "feat: auth validation schemas and server actions"`.

---

## Task 4: Register & login pages (public)

**Files:** Create `src/app/[locale]/(public)/register/page.tsx`, `register/register-form.tsx`, `login/page.tsx`, `login/login-form.tsx`; add `auth` keys to the three message catalogs.

Note: Plan 1's landing page is at `src/app/[locale]/page.tsx`. Wrapping it in a `(public)` group is optional; do NOT move it in this task to avoid churn — just add the new route folders under `[locale]/(public)/` (route groups don't affect URL).

- [ ] **Step 1: Add translation keys** to `de.json`/`fr.json`/`en.json` under a new `"auth"` namespace: `registerTitle`, `loginTitle`, `email`, `password`, `displayName`, `roleClient` ("Ich suche Fotograf:innen" / "Je cherche un·e photographe" / "I'm hiring a photographer"), `rolePhotographer` ("Ich bin Fotograf:in" / "Je suis photographe" / "I'm a photographer"), `submitRegister`, `submitLogin`, `haveAccount`, `noAccount`, `checkEmail` (confirmation notice), `genericError`. Keep keys symmetric across all three files.

- [ ] **Step 2: Create `register/register-form.tsx`** (client component): a `react-hook-form` form (install `react-hook-form @hookform/resolvers` if absent) with fields email, password, displayName, a role segmented control (client/photographer), hidden locale from `useLocale()`. On submit call `registerAction`; on `{ok:true}` show the "check your email" confirmation state; on error show the message. Use theme tokens + the prototype's `.label`/`.press` aesthetic (option cards use `.opt-selected` look: selected = `border-ink bg-surface`). Use translation keys from step 1.

- [ ] **Step 3: Create `register/page.tsx`** — server component: if already logged in (`getSessionUser()`), `redirect` to `/home`; else render `<RegisterForm/>` centered, max-width ~26rem, with a link to login.

- [ ] **Step 4: Create `login/login-form.tsx`** — client component, email+password, calls `loginAction`; on `{ok:true}` `router.push("/home")` (locale-aware `useRouter` from `@/i18n/navigation`) and `router.refresh()`. On error show message.

- [ ] **Step 5: Create `login/page.tsx`** — server component; if logged in redirect to `/home`; else render `<LoginForm/>` with link to register.

- [ ] **Step 6: Verify** with dev server: `/de/register` renders, role toggle works; `/de/login` renders. Build/lint/typecheck green. (Full signup E2E is exercised in Task 8.) Commit: `git commit -m "feat: register and login pages"`.

---

## Task 5: Authenticated shell + route protection

**Files:** Modify `src/lib/supabase/middleware.ts` (add gating); Create `src/app/[locale]/(app)/layout.tsx`, `src/components/app-nav.tsx`, `src/components/sign-out-button.tsx`, `src/app/[locale]/(app)/home/page.tsx`; add `nav`/`home` keys as needed.

- [ ] **Step 1: Add route gating to `updateSession`** in `src/lib/supabase/middleware.ts`. After `getUser()`, if the path (strip the locale prefix) starts with a protected segment (`/home`, `/profile`, `/settings`, `/my-shoots`, `/my-bids`, `/shoots/new`) and there is no user, return a redirect to `/<locale>/login`. Derive locale from the first path segment (fallback `de`). Keep the existing session-refresh behavior for all other paths. Pseudocode:

```ts
const { data: { user } } = await supabase.auth.getUser();
const segments = request.nextUrl.pathname.split("/").filter(Boolean);
const locale = ["de","fr","en"].includes(segments[0]) ? segments[0] : "de";
const rest = "/" + segments.slice(1).join("/");
const PROTECTED = ["/home","/profile","/settings","/my-shoots","/my-bids","/shoots/new"];
if (!user && PROTECTED.some((p) => rest === p || rest.startsWith(p + "/"))) {
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  return NextResponse.redirect(url);
}
return response;
```

(Import `NextResponse` from `next/server`. The function already receives `response`; build the redirect from `request.nextUrl`.)

- [ ] **Step 2: Create `src/components/sign-out-button.tsx`** (client): a button that calls `logoutAction` (server action) inside a `<form action={logoutAction}>` — simplest correct pattern. Styled with `.press`, `.label`.

- [ ] **Step 3: Create `src/components/app-nav.tsx`** (server component): role-aware nav. Receives `role` + `displayName`. Renders the brand, primary links per role (client: Home, "Auftrag erstellen" → `/shoots/new`, "Meine Aufträge" → `/my-shoots`, Profil; photographer: Home, "Aufträge" → `/shoots`, "Meine Angebote" → `/my-bids`, Profil — links can point to not-yet-built routes, that's fine for now), the LocaleSwitcher, and the SignOutButton. Desktop: top bar; mobile: it's fine to render the same bar (full responsive bottom-tab bar lands in a later plan). Use `Link` from `@/i18n/navigation`.

- [ ] **Step 4: Create `src/app/[locale]/(app)/layout.tsx`** (server): fetch `getProfile()`; if null → `redirect` to `/login`. If the profile exists but the user is a photographer with NO `photographer_details` row yet, `redirect` to `/onboarding` (Task 6). Otherwise render `<AppNav role=… displayName=…/>` + `{children}` on `bg-paper`.

- [ ] **Step 5: Create `src/app/[locale]/(app)/home/page.tsx`** — role-aware dashboard stub: greet by `display_name`; client sees a CTA card to create a shoot; photographer sees a CTA to browse open shoots. Pull a couple of relevant rows (client: their latest shoots via RLS; photographer: latest open shoots) to prove the authed data path works. Keep it simple and themed.

- [ ] **Step 6: Verify:** logged-out visit to `/de/home` → redirected to `/de/login`. After logging in (seed user `lena@example.ch` / `password123`), `/de/home` renders the client dashboard. Build/lint/typecheck green. Commit: `git commit -m "feat: authenticated app shell with route protection"`.

---

## Task 6: Photographer onboarding (details + portfolio upload)

**Files:** Create `src/lib/validation/photographer.ts`, `src/lib/actions/photographer.ts`, `src/app/[locale]/(app)/onboarding/page.tsx`, `onboarding/onboarding-form.tsx`, `src/components/canton-multiselect.tsx`; Test `src/lib/validation/photographer.test.ts`. Add `onboarding` message keys.

- [ ] **Step 1: Write failing test** `src/lib/validation/photographer.test.ts` for `photographerDetailsSchema`: accepts `{ specialties: ["wedding"], coverageCantons: ["ZH"], hourlyRateChf: 280 }`; rejects empty specialties; rejects `hourlyRateChf` ≤ 0; rejects an unknown canton. Run → FAIL.

- [ ] **Step 2: Implement `src/lib/validation/photographer.ts`:**

```ts
import { z } from "zod";

const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"] as const;
const SHOOT_TYPES = ["wedding","portrait","commercial","event","architecture","family","other"] as const;

export const photographerDetailsSchema = z.object({
  specialties: z.array(z.enum(SHOOT_TYPES)).min(1).max(7),
  coverageCantons: z.array(z.enum(CANTONS)).min(1),
  hourlyRateChf: z.coerce.number().int().positive().max(100000).optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
});

export type PhotographerDetailsInput = z.infer<typeof photographerDetailsSchema>;
export { CANTONS, SHOOT_TYPES };
```

Run test → pass.

- [ ] **Step 3: Implement `src/lib/actions/photographer.ts`** with two actions:
  - `savePhotographerDetails(raw)`: validate; `getSessionUser()`; upsert into `photographer_details` (`profile_id = user.id`, mapping camelCase→snake_case, empty-string URLs→null). Return ActionResult.
  - `addPortfolioImage(formData)`: read a `File` from FormData; `getSessionUser()`; guard the 20-image cap by counting first (the DB trigger is the hard guard, this is UX); upload to the `portfolio` bucket at path `${user.id}/${crypto.randomUUID()}.<ext>`; insert a `portfolio_images` row with `storage_path`. Return `{ ok, path }` or error. (Use `supabase.storage.from("portfolio").upload(path, file)`.)
  - `removePortfolioImage(imageId)`: look up the row (RLS ensures ownership), delete the storage object, delete the row.

- [ ] **Step 4: Create `src/components/canton-multiselect.tsx`** (client): a compact chip grid of the 26 cantons; selected chips get `border-ink bg-surface`. Controlled value + onChange (string[]). Reused for both specialties and cantons (make it generic: `options: {value,label}[]`). Actually create a generic `ChipMultiSelect`.

- [ ] **Step 5: Create `onboarding/onboarding-form.tsx`** (client): specialties ChipMultiSelect (labels via `shoot.types.*`), cantons ChipMultiSelect, optional hourly rate (CHF) + website + instagram, then a portfolio uploader (multiple file input → calls `addPortfolioImage` per file, shows thumbnails via the public bucket URL, allows remove). Submit calls `savePhotographerDetails`; on success `router.push("/home")` + refresh. Add `onboarding` translation keys (title, specialties, cantons, hourlyRate, website, instagram, portfolio, addPhotos, finish) to all three catalogs.

- [ ] **Step 6: Create `onboarding/page.tsx`** (server): require a photographer profile (`getProfile()`; if not photographer → `redirect("/home")`; if photographer_details already exists → `redirect("/home")`). Render the form.

- [ ] **Step 7: Verify** with dev server: register a NEW photographer (e.g. `test-photog@example.ch`) — because email confirmation is enabled by default in local Supabase, confirm via the Inbucket/Mailpit UI (`npx supabase status` shows the mail URL, usually http://127.0.0.1:54324) OR temporarily note that local config auto-confirms; then log in → `(app)/layout` redirects to `/onboarding`; fill specialties+cantons, upload one image, finish → lands on `/home` and no longer redirects to onboarding. Build/lint/typecheck green. Commit: `git commit -m "feat: photographer onboarding with portfolio upload"`.

---

## Task 7: Wire auth entry points on the landing page

**Files:** Modify `src/app/[locale]/page.tsx` (+ maybe `app-nav` reuse).

- [ ] **Step 1:** In the landing header, add login/register links (locale-aware `Link`) when logged out, or a "Home"/dashboard link + display name when logged in (`getSessionUser()`/`getProfile()`). The hero CTA ("Auftrag erstellen" / cta) links to `/register` when logged out, `/shoots/new` when logged in as client, `/home` otherwise.

- [ ] **Step 2: Verify** all three locales still render; logged-out shows login/register; logged-in (seed user) shows dashboard link. Build/lint/typecheck green. Commit: `git commit -m "feat: auth-aware landing header and CTA"`.

---

## Task 8: Playwright E2E for the auth journey

**Files:** Create `playwright.config.ts`, `e2e/auth.spec.ts`; add `e2e` + `test:e2e` scripts; install `@playwright/test`.

Local Supabase: to make signup testable without clicking email links, the test can use a seeded, pre-confirmed account for the login path, and for the registration path assert the "check your email" confirmation screen appears (not full inbox flow). Keep E2E deterministic.

- [ ] **Step 1: Install** `npm install -D @playwright/test` then `npx playwright install --with-deps chromium`.

- [ ] **Step 2: Create `playwright.config.ts`** — testDir `e2e`, baseURL `http://localhost:3000`, a `webServer` that runs `npm run dev` (reuseExistingServer locally), chromium project.

- [ ] **Step 3: Create `e2e/auth.spec.ts`** with:
  - **login + protected route:** visit `/de/home` → expect redirect to `/de/login`. Log in as `lena@example.ch` / `password123` → expect to land on `/de/home` and see her display name. Sign out → expect landing/login.
  - **registration validation:** on `/de/register`, submit with a 3-char password → expect a validation error, no navigation.
  - **registration happy path:** register a uniquely-emailed client → expect the "check your email" confirmation screen.
  (Use stable selectors — add `data-testid` attributes to the relevant inputs/buttons in the forms as needed.)

- [ ] **Step 4: Add scripts** to package.json: `"test:e2e": "playwright test"`. Run `npm run test:e2e` (Supabase + a dev server must be available; Playwright's webServer handles the app). Iterate until green.

- [ ] **Step 5: Wire E2E into CI** — add a job to `.github/workflows/ci.yml` that starts Supabase, runs migrations+seed (`supabase db reset` after `supabase start`, or rely on start), builds, and runs Playwright. Keep it a separate job from the unit `app` job. Use dummy-safe env where possible; the e2e job needs the real local anon key from `supabase status` (export into `$GITHUB_ENV`).

- [ ] **Step 6: Commit** — `git commit -m "test(e2e): auth journey with Playwright + CI job"`.

---

## Task 9: Plan 2 review & merge

- [ ] **Step 1:** Run the full matrix: `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`, `npx supabase test db`, `npm run test:e2e`. All green.
- [ ] **Step 2:** Dispatch a security-focused review of the new Server Actions and middleware gating (does any action trust client-supplied identity instead of `getSessionUser()`? can the onboarding upload path write outside the user's folder? does middleware gating have a bypass via missing locale prefix?). Fix findings.
- [ ] **Step 3:** Merge `feat/plan-2-auth` → `main` (`--no-ff`), tag `v0.2.0-auth`.

---

## Done =

- A logged-out user can register (client or photographer) and log in.
- Protected routes redirect to login; the app shell is role-aware with sign-out.
- Photographers complete onboarding (specialties, cantons, portfolio upload) before reaching the app.
- Auth journey covered by Playwright E2E, green in CI alongside the 25 RLS assertions.
- Next: Plan 3 (client flow — post a shoot, my-shoots, shoot detail, accept/decline).
