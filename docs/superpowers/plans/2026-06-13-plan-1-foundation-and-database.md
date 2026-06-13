# Rintakez Plan 1: Foundation & Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the production Next.js app (themed from the prototype, trilingual, PWA-ready) and the complete Supabase database with RLS security, tested and seeded — spec phases 1–2.

**Architecture:** Single Next.js 16 (App Router, TS) app; Supabase (Postgres + Auth + Storage) as backend; RLS is the security boundary, all multi-row state transitions live in DB functions. Prototype stays in `prototype/` as visual reference.

**Tech Stack:** Next.js 16, TypeScript, Tailwind v4, next-intl, @supabase/ssr, supabase-js, Vitest, pgTAP, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-13-rintakez-marketplace-design.md` (read §2–§3 before starting).

Subsequent plans (written after this one ships): Plan 2 auth & onboarding, Plan 3 client flow, Plan 4 photographer flow, Plan 5 public pages/PWA/polish, Plan 6 launch hardening.

---

## Task 1: Relocate prototype, scaffold Next.js

**Files:**
- Move: all prototype files → `prototype/`
- Create: Next.js scaffold at repo root (`src/`, `package.json`, `next.config.ts`, …)

- [ ] **Step 1: Move prototype files into `prototype/`**

```bash
mkdir prototype
git mv icons.jsx theme.css index.html prototype.html data.jsx i18n.jsx canvas.jsx \
  photog-screens.jsx screens.jsx app.jsx design-canvas.jsx client-screens.jsx \
  tweaks-panel.jsx screens prototype/
git commit -m "chore: move design prototype into prototype/"
```

- [ ] **Step 2: Scaffold Next.js into a temp dir, then move to root**

```bash
npx create-next-app@latest scaffold-tmp --typescript --tailwind --eslint --app \
  --src-dir --turbopack --import-alias "@/*" --skip-install --yes
rm -rf scaffold-tmp/.git
rsync -a scaffold-tmp/ ./
rm -rf scaffold-tmp
npm install
```

- [ ] **Step 3: Set package name and scripts** — in `package.json` set `"name": "rintakez"` and add to `"scripts"`:

```json
"typecheck": "tsc --noEmit",
"test": "vitest",
"db:start": "supabase start",
"db:reset": "supabase db reset",
"db:test": "supabase test db"
```

- [ ] **Step 4: Verify dev server runs**

Run: `npm run dev` → open http://localhost:3000
Expected: default Next.js welcome page renders. Stop the server.

- [ ] **Step 5: Append to `.gitignore`** (create-next-app's one is in place; ensure these lines exist):

```
.env*.local
supabase/.temp
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js 16 app (TS, Tailwind, App Router)"
```

---

## Task 2: Port prototype theme to Tailwind v4

**Files:**
- Modify: `src/app/globals.css` (full replacement below)
- Modify: `src/app/layout.tsx` (font + data-theme)

The prototype's `prototype/theme.css` is the source. We port the **token system** (paper/surface/chip/ink/mute/line/accent, light+dark) — not the device-frame/canvas chrome, which is prototype-only.

- [ ] **Step 1: Replace `src/app/globals.css` entirely with:**

```css
@import "tailwindcss";

/* ── Atelier tokens, ported from prototype/theme.css ────────────── */
:root,
[data-theme="light"] {
  --accent-rgb: 200 70 44;
  --paper-rgb: 255 255 255;
  --surface-rgb: 250 250 249;
  --chip-rgb: 244 244 242;
  --ink-rgb: 10 10 10;
  --mute-rgb: 115 115 115;
  --mute-2-rgb: 168 168 168;
  --line-rgb: 232 232 228;
  --line-strong-rgb: 214 214 209;
}

[data-theme="dark"] {
  --accent-rgb: 217 100 74;
  --paper-rgb: 10 10 10;
  --surface-rgb: 22 22 22;
  --chip-rgb: 28 28 28;
  --ink-rgb: 245 244 240;
  --mute-rgb: 136 136 132;
  --mute-2-rgb: 85 85 80;
  --line-rgb: 34 34 32;
  --line-strong-rgb: 48 48 45;
}

:root,
[data-theme] {
  --paper: rgb(var(--paper-rgb));
  --surface: rgb(var(--surface-rgb));
  --chip: rgb(var(--chip-rgb));
  --ink: rgb(var(--ink-rgb));
  --mute: rgb(var(--mute-rgb));
  --mute-2: rgb(var(--mute-2-rgb));
  --line: rgb(var(--line-rgb));
  --line-strong: rgb(var(--line-strong-rgb));
  --accent: rgb(var(--accent-rgb));
  --backdrop: rgb(var(--ink-rgb) / 0.42);
}

/* Expose tokens as Tailwind utilities: bg-paper, text-ink, border-line, … */
@theme inline {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-chip: var(--chip);
  --color-ink: var(--ink);
  --color-mute: var(--mute);
  --color-mute-2: var(--mute-2);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-accent: var(--accent);
  --font-sans: var(--font-inter-tight), system-ui, sans-serif;
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-inter-tight), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01", "cv11";
}

/* Type helpers carried over from the prototype */
.tabular { font-variant-numeric: tabular-nums; }
.label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 10.5px;
  font-weight: 500;
}
.press { transition: transform 80ms ease, opacity 80ms ease; }
.press:active { transform: scale(0.985); opacity: 0.92; }

html, body {
  transition: background-color 220ms ease, color 220ms ease;
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx` with:**

```tsx
import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: "Rintakez",
  description: "Fotografie-Marktplatz Schweiz",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" data-theme="light" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}
```

(Task 4 will move this into `[locale]/layout.tsx`; keeping it here makes this task independently verifiable.)

- [ ] **Step 3: Smoke-check the theme** — replace the content of `src/app/page.tsx` with:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-paper text-ink p-8">
      <p className="label text-mute">Rintakez</p>
      <h1 className="text-3xl font-medium tracking-tight">Theme OK</h1>
      <div className="mt-4 h-px bg-line" />
      <button className="press mt-4 bg-accent text-white px-4 py-2">
        Accent
      </button>
    </main>
  );
}
```

Run: `npm run dev` → page shows white bg, near-black ink text, terracotta accent button. Toggle `data-theme="dark"` in layout.tsx, reload, verify dark palette, then set it back to `"light"`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: port Atelier design tokens to Tailwind v4 theme"
```

---

## Task 3: Vitest + Swiss formatting utilities (TDD)

**Files:**
- Create: `vitest.config.ts`, `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

- [ ] **Step 1: Install and configure Vitest**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Write the failing tests** — create `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCHF, formatCHFRange, formatSwissDate } from "./format";

describe("formatCHF", () => {
  it("formats with apostrophe thousands separator", () => {
    expect(formatCHF(3200)).toBe("CHF 3'200");
  });
  it("handles amounts under 1000 without separator", () => {
    expect(formatCHF(950)).toBe("CHF 950");
  });
  it("handles millions", () => {
    expect(formatCHF(1250000)).toBe("CHF 1'250'000");
  });
});

describe("formatCHFRange", () => {
  it("formats a budget range with en dash", () => {
    expect(formatCHFRange(3200, 4500)).toBe("CHF 3'200 – 4'500");
  });
});

describe("formatSwissDate", () => {
  it("formats ISO date as dd.MM.yyyy", () => {
    expect(formatSwissDate("2026-08-14")).toBe("14.08.2026");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run`
Expected: FAIL — `Cannot find module './format'`

- [ ] **Step 4: Implement** — create `src/lib/format.ts` (logic ported from `prototype/data.jsx`):

```ts
/** Swiss number formatting: 3200 -> "3'200" */
function chf(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatCHF(n: number): string {
  return `CHF ${chf(n)}`;
}

export function formatCHFRange(min: number, max: number): string {
  return `CHF ${chf(min)} – ${chf(max)}`;
}

/** "2026-08-14" -> "14.08.2026" */
export function formatSwissDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Swiss CHF/date formatting utilities with tests"
```

---

## Task 4: Trilingual routing with next-intl

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`
- Create: `src/i18n/messages/de.json`, `fr.json`, `en.json`
- Create: `src/middleware.ts`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`
- Modify: `next.config.ts`
- Delete: `src/app/layout.tsx`, `src/app/page.tsx` (move under `[locale]/`)

- [ ] **Step 1: Install**

```bash
npm install next-intl
```

- [ ] **Step 2: Create `src/i18n/routing.ts`:**

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "fr", "en"],
  defaultLocale: "de",
});

export type Locale = (typeof routing.locales)[number];
```

- [ ] **Step 3: Create `src/i18n/navigation.ts`:**

```ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

- [ ] **Step 4: Create `src/i18n/request.ts`:**

```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Create message files** (starter set, migrated from `prototype/i18n.jsx`; later plans extend these per feature).

`src/i18n/messages/de.json`:

```json
{
  "common": {
    "appName": "Rintakez",
    "back": "Zurück",
    "next": "Weiter",
    "cancel": "Abbrechen",
    "save": "Speichern"
  },
  "nav": {
    "home": "Home",
    "browse": "Aufträge",
    "profile": "Profil",
    "login": "Anmelden",
    "register": "Registrieren"
  },
  "landing": {
    "title": "Fotografie. Direkt. Schweizweit.",
    "subtitle": "Beschreibe deinen Shoot, erhalte Angebote von professionellen Fotograf:innen aus deiner Region.",
    "cta": "Auftrag erstellen",
    "latestShoots": "Offene Aufträge",
    "offersCount": "{count, plural, =0 {Keine Angebote} one {# Angebot} other {# Angebote}}"
  },
  "shoot": {
    "date": "Datum",
    "location": "Ort",
    "duration": "Dauer",
    "budget": "Budget",
    "type": "Art",
    "statusOpen": "Offen",
    "hours": "{count} Std",
    "types": {
      "wedding": "Hochzeit",
      "portrait": "Porträt",
      "commercial": "Commercial",
      "event": "Event",
      "architecture": "Architektur",
      "family": "Familie",
      "other": "Andere"
    }
  }
}
```

`src/i18n/messages/fr.json`:

```json
{
  "common": {
    "appName": "Rintakez",
    "back": "Retour",
    "next": "Suivant",
    "cancel": "Annuler",
    "save": "Enregistrer"
  },
  "nav": {
    "home": "Accueil",
    "browse": "Missions",
    "profile": "Profil",
    "login": "Connexion",
    "register": "S'inscrire"
  },
  "landing": {
    "title": "Photographie. En direct. Dans toute la Suisse.",
    "subtitle": "Décris ton shoot et reçois des offres de photographes professionnels de ta région.",
    "cta": "Créer une mission",
    "latestShoots": "Missions ouvertes",
    "offersCount": "{count, plural, =0 {Aucune offre} one {# offre} other {# offres}}"
  },
  "shoot": {
    "date": "Date",
    "location": "Lieu",
    "duration": "Durée",
    "budget": "Budget",
    "type": "Type",
    "statusOpen": "Ouvert",
    "hours": "{count} h",
    "types": {
      "wedding": "Mariage",
      "portrait": "Portrait",
      "commercial": "Commercial",
      "event": "Événement",
      "architecture": "Architecture",
      "family": "Famille",
      "other": "Autre"
    }
  }
}
```

`src/i18n/messages/en.json`:

```json
{
  "common": {
    "appName": "Rintakez",
    "back": "Back",
    "next": "Next",
    "cancel": "Cancel",
    "save": "Save"
  },
  "nav": {
    "home": "Home",
    "browse": "Shoots",
    "profile": "Profile",
    "login": "Log in",
    "register": "Sign up"
  },
  "landing": {
    "title": "Photography. Direct. Across Switzerland.",
    "subtitle": "Describe your shoot and receive offers from professional photographers in your region.",
    "cta": "Post a shoot",
    "latestShoots": "Open shoots",
    "offersCount": "{count, plural, =0 {No offers} one {# offer} other {# offers}}"
  },
  "shoot": {
    "date": "Date",
    "location": "Location",
    "duration": "Duration",
    "budget": "Budget",
    "type": "Type",
    "statusOpen": "Open",
    "hours": "{count} h",
    "types": {
      "wedding": "Wedding",
      "portrait": "Portrait",
      "commercial": "Commercial",
      "event": "Event",
      "architecture": "Architecture",
      "family": "Family",
      "other": "Other"
    }
  }
}
```

- [ ] **Step 6: Wire the plugin** — replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },
};

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Create `src/middleware.ts`:**

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 8: Move layout/page under `[locale]`** — delete `src/app/layout.tsx` and `src/app/page.tsx`; create `src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: "Rintakez",
  description: "Fotografie-Marktplatz Schweiz",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} data-theme="light" className={interTight.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Create `src/app/[locale]/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("landing");
  return (
    <main className="min-h-screen bg-paper text-ink p-8">
      <p className="label text-mute">Rintakez</p>
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
    </main>
  );
}
```

- [ ] **Step 9: Verify all three locales**

Run: `npm run dev`. Check:
- http://localhost:3000 → redirects to `/de`, shows "Fotografie. Direkt. Schweizweit."
- `/fr` → "Photographie. En direct. Dans toute la Suisse."
- `/en` → "Photography. Direct. Across Switzerland."

- [ ] **Step 10: Verify build + tests, commit**

Run: `npm run build && npx vitest run` → both green.

```bash
git add -A && git commit -m "feat: trilingual routing de/fr/en with next-intl"
```

---

## Task 5: Supabase local stack + client helpers

**Files:**
- Create: `supabase/config.toml` (via CLI), `.env.local`, `.env.example`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Modify: `src/middleware.ts`

Prerequisite: Docker Desktop running.

- [ ] **Step 1: Install CLI + libs, init project**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase
npx supabase init
```

Expected: creates `supabase/config.toml`.

- [ ] **Step 2: Start the local stack**

Run: `npx supabase start`
Expected: prints API URL `http://127.0.0.1:54321`, `anon key`, `service_role key`, Studio URL `http://127.0.0.1:54323`.

- [ ] **Step 3: Create `.env.local`** (values from the `supabase start` output):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from output>
```

Create `.env.example` with the same keys but placeholder values (commit this one):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Create `src/lib/supabase/client.ts`** (browser):

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 5: Create `src/lib/supabase/server.ts`** (Server Components / Actions):

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 6: Create `src/lib/supabase/middleware.ts`** (session refresh):

```ts
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";

export async function updateSession(
  request: NextRequest,
  response: NextResponse
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if expired. Do not remove.
  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 7: Combine i18n + session refresh** — replace `src/middleware.ts` with:

```ts
import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const handleI18n = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = handleI18n(request);
  return await updateSession(request, response);
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 8: Verify** — `npm run dev`, load `/de`; page renders, no middleware errors in terminal. `npm run build` green.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: Supabase local stack and SSR client helpers"
```

---

## Task 6: Migration 1 — schema (enums, tables, indexes, triggers)

**Files:**
- Create: `supabase/migrations/20260613000001_schema.sql`

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new schema
```

Rename/locate the generated file under `supabase/migrations/` and fill it with:

```sql
-- Rintakez schema. Spec §3. RLS policies live in the next migration.

create type public.user_role as enum ('client', 'photographer');
create type public.locale as enum ('de', 'fr', 'en');
create type public.canton as enum (
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE',
  'NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'
);
create type public.shoot_type as enum (
  'wedding','portrait','commercial','event','architecture','family','other'
);
create type public.shoot_status as enum ('open','assigned','completed','cancelled');
create type public.bid_status as enum ('pending','accepted','declined','withdrawn');

-- ── profiles ────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  avatar_url text,
  city text,
  canton public.canton,
  locale public.locale not null default 'de',
  bio text,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup; role/name/locale come from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, locale)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'client'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'locale')::public.locale, 'de')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── photographer_details ────────────────────────────────────────────
create table public.photographer_details (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  specialties public.shoot_type[] not null default '{}',
  coverage_cantons public.canton[] not null default '{}',
  hourly_rate_chf integer check (hourly_rate_chf > 0),
  website_url text,
  instagram_url text,
  created_at timestamptz not null default now()
);

-- ── portfolio_images ────────────────────────────────────────────────
create table public.portfolio_images (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index portfolio_images_photographer_idx
  on public.portfolio_images (photographer_id);

-- Hard cap: 20 portfolio images per photographer.
create or replace function public.enforce_portfolio_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.portfolio_images
      where photographer_id = new.photographer_id) >= 20 then
    raise exception 'portfolio limit reached (20 images)';
  end if;
  return new;
end;
$$;

create trigger portfolio_limit
  before insert on public.portfolio_images
  for each row execute function public.enforce_portfolio_limit();

-- ── shoots ──────────────────────────────────────────────────────────
create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  type public.shoot_type not null,
  brief text not null check (char_length(brief) between 10 and 4000),
  location_city text not null,
  location_postcode text check (location_postcode ~ '^[0-9]{4}$'),
  canton public.canton not null,
  shoot_date date not null,
  duration_hours integer not null check (duration_hours between 1 and 24),
  budget_min_chf integer not null check (budget_min_chf > 0),
  budget_max_chf integer not null,
  status public.shoot_status not null default 'open',
  accepted_bid_id uuid, -- FK added after bids exists
  created_at timestamptz not null default now(),
  constraint budget_range check (budget_max_chf >= budget_min_chf)
);

create index shoots_browse_idx on public.shoots (status, canton, shoot_date);
create index shoots_client_idx on public.shoots (client_id);

-- ── bids ────────────────────────────────────────────────────────────
create table public.bids (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  photographer_id uuid not null references public.profiles (id) on delete cascade,
  amount_chf integer not null check (amount_chf > 0),
  message text not null check (char_length(message) between 10 and 2000),
  status public.bid_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint one_bid_per_photographer unique (shoot_id, photographer_id)
);

create index bids_shoot_idx on public.bids (shoot_id);
create index bids_photographer_idx on public.bids (photographer_id);

alter table public.shoots
  add constraint shoots_accepted_bid_fk
  foreign key (accepted_bid_id) references public.bids (id);
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: "Applying migration 20260613000001_schema.sql… Finished supabase db reset". Open Studio (http://127.0.0.1:54323) → tables visible.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): core schema — profiles, shoots, bids, portfolio"
```

---

## Task 7: Migration 2 — RLS, accept_bid, storage

**Files:**
- Create: `supabase/migrations/20260613000002_security.sql`

- [ ] **Step 1: Create the migration**

```bash
npx supabase migration new security
```

Fill with:

```sql
-- RLS is the security boundary (spec §3.8). The anon key is public by design.
-- Helper functions are SECURITY DEFINER to avoid recursive policy evaluation
-- (shoots policies reference bids and vice versa).

alter table public.profiles enable row level security;
alter table public.photographer_details enable row level security;
alter table public.portfolio_images enable row level security;
alter table public.shoots enable row level security;
alter table public.bids enable row level security;

-- ── helpers ─────────────────────────────────────────────────────────
create or replace function public.is_shoot_client(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shoots where id = p_shoot_id and client_id = auth.uid()
  );
$$;

create or replace function public.is_accepted_photographer(p_shoot_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from shoots s
    join bids b on b.id = s.accepted_bid_id
    where s.id = p_shoot_id and b.photographer_id = auth.uid()
  );
$$;

create or replace function public.has_role(p_role public.user_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = p_role
  );
$$;

-- Public bid count per shoot (photographers must not see competitor bids,
-- only the count shown on cards).
create or replace function public.shoot_bid_count(p_shoot_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::int from bids
  where shoot_id = p_shoot_id and status in ('pending', 'accepted');
$$;

-- ── profiles ────────────────────────────────────────────────────────
create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
-- role is immutable in v1: the WITH CHECK pins it to its current value.
-- INSERT happens only via the on_auth_user_created trigger (security definer).

-- ── photographer_details ────────────────────────────────────────────
create policy "photographer_details_select_all" on public.photographer_details
  for select using (true);

create policy "photographer_details_insert_own" on public.photographer_details
  for insert with check (profile_id = auth.uid() and public.has_role('photographer'));

create policy "photographer_details_update_own" on public.photographer_details
  for update using (profile_id = auth.uid());

-- ── portfolio_images ────────────────────────────────────────────────
create policy "portfolio_select_all" on public.portfolio_images
  for select using (true);

create policy "portfolio_insert_own" on public.portfolio_images
  for insert with check (photographer_id = auth.uid() and public.has_role('photographer'));

create policy "portfolio_delete_own" on public.portfolio_images
  for delete using (photographer_id = auth.uid());

-- ── shoots ──────────────────────────────────────────────────────────
create policy "shoots_select" on public.shoots
  for select using (
    status = 'open'
    or client_id = auth.uid()
    or public.is_accepted_photographer(id)
  );

create policy "shoots_insert_client" on public.shoots
  for insert with check (client_id = auth.uid() and public.has_role('client'));

-- Client may edit while open; cancel until completed. Status transitions
-- to assigned/completed happen only via functions below.
create policy "shoots_update_own" on public.shoots
  for update using (client_id = auth.uid() and status in ('open', 'assigned'))
  with check (client_id = auth.uid() and status in ('open', 'cancelled'));

-- ── bids ────────────────────────────────────────────────────────────
create policy "bids_select_own_or_shoot_client" on public.bids
  for select using (
    photographer_id = auth.uid()
    or public.is_shoot_client(shoot_id)
  );

create policy "bids_insert_photographer" on public.bids
  for insert with check (
    photographer_id = auth.uid()
    and public.has_role('photographer')
    and exists (
      select 1 from public.shoots s
      where s.id = shoot_id and s.status = 'open' and s.client_id <> auth.uid()
    )
  );

create policy "bids_update_own_pending" on public.bids
  for update using (photographer_id = auth.uid() and status = 'pending')
  with check (photographer_id = auth.uid() and status in ('pending', 'withdrawn'));

-- ── accept_bid: the one critical transaction (spec §3.7) ───────────
create or replace function public.accept_bid(p_bid_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shoot_id uuid;
  v_client_id uuid;
begin
  select b.shoot_id, s.client_id
    into v_shoot_id, v_client_id
  from bids b
  join shoots s on s.id = b.shoot_id
  where b.id = p_bid_id
    and b.status = 'pending'
    and s.status = 'open'
  for update of b, s;

  if v_shoot_id is null then
    raise exception 'bid not acceptable';
  end if;

  if v_client_id is distinct from auth.uid() then
    raise exception 'not your shoot';
  end if;

  update bids set status = 'accepted' where id = p_bid_id;

  update bids set status = 'declined'
  where shoot_id = v_shoot_id and id <> p_bid_id and status = 'pending';

  update shoots set status = 'assigned', accepted_bid_id = p_bid_id
  where id = v_shoot_id;
end;
$$;

-- Contact exchange after acceptance (spec §3.8): each party may read the
-- other's email only on an assigned/completed shoot they belong to.
create or replace function public.get_counterparty_email(p_shoot_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shoot shoots%rowtype;
  v_photographer_id uuid;
  v_email text;
begin
  select * into v_shoot from shoots
  where id = p_shoot_id and status in ('assigned', 'completed');

  if not found then
    raise exception 'no contact available';
  end if;

  select photographer_id into v_photographer_id
  from bids where id = v_shoot.accepted_bid_id;

  if auth.uid() = v_shoot.client_id then
    select email into v_email from auth.users where id = v_photographer_id;
  elsif auth.uid() = v_photographer_id then
    select email into v_email from auth.users where id = v_shoot.client_id;
  else
    raise exception 'no contact available';
  end if;

  return v_email;
end;
$$;

-- Functions callable by signed-in users only.
revoke execute on function public.accept_bid(uuid) from anon;
revoke execute on function public.get_counterparty_email(uuid) from anon;

-- ── storage buckets ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('portfolio', 'portfolio', true);

-- Users write only inside their own folder: <uid>/<filename>
create policy "storage_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage_delete_own_folder" on storage.objects
  for delete using (
    bucket_id in ('avatars', 'portfolio')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 2: Apply**

Run: `npx supabase db reset`
Expected: both migrations apply cleanly.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): RLS policies, accept_bid transaction, storage buckets"
```

---

## Task 8: pgTAP tests for the RLS matrix

**Files:**
- Create: `supabase/tests/database/rls.test.sql`

These tests ARE the security verification — every deny case in spec §3.8 must be asserted. They run inside one rolled-back transaction.

- [ ] **Step 1: Create `supabase/tests/database/rls.test.sql`:**

```sql
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

-- ── fixtures: 1 client + 2 photographers (trigger creates profiles) ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'client@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"client","display_name":"Lena K."}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marko@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Marko B."}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'anna@test.ch', extensions.crypt('pw', extensions.gen_salt('bf')),
   now(), '{"role":"photographer","display_name":"Anna S."}', now(), now());

insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Hochzeit in Zermatt', 'wedding', 'Dokumentarischer Stil, Bergkapelle.',
   'Zermatt', 'VS', '2027-08-14', 10, 3200, 4500);

-- A cancelled shoot that must be invisible to others
insert into public.shoots (id, client_id, title, type, brief, location_city,
                           canton, shoot_date, duration_hours,
                           budget_min_chf, budget_max_chf, status)
values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Abgesagter Termin', 'portrait', 'Wird nicht stattfinden.',
   'Bern', 'BE', '2027-09-01', 2, 500, 800, 'cancelled');

insert into public.bids (id, shoot_id, photographer_id, amount_chf, message)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000002', 3800, 'Ruhiger dokumentarischer Stil.'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000003', 4200, 'Editorial und ehrlich.');

-- ── 1–5: tables exist ────────────────────────────────────────────────
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'photographer_details', 'photographer_details exists');
select has_table('public', 'portfolio_images', 'portfolio_images exists');
select has_table('public', 'shoots', 'shoots exists');
select has_table('public', 'bids', 'bids exists');

-- ── 6: anon sees only open shoots ────────────────────────────────────
set local role anon;
select results_eq(
  'select count(*)::int from public.shoots',
  array[1],
  'anon sees only the open shoot, not the cancelled one'
);
reset role;

-- ── 7: photographer Anna cannot see Markos bid ──────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select results_eq(
  'select count(*)::int from public.bids',
  array[1],
  'photographer sees only her own bid'
);
reset role;

-- ── 8: client sees both bids on own shoot ────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  'select count(*)::int from public.bids',
  array[2],
  'client sees all bids on own shoot'
);

-- ── 9: client cannot insert a bid (wrong role) ──────────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000001', 1000, 'Ich biete mit.')$$,
  '42501',
  'new row violates row-level security policy for table "bids"',
  'client role cannot bid'
);
reset role;

-- ── 10: photographer cannot bid on a non-open shoot ─────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000002', 600, 'Biete trotzdem.')$$,
  '42501',
  'new row violates row-level security policy for table "bids"',
  'cannot bid on cancelled shoot'
);

-- ── 11: duplicate bid blocked by unique constraint ───────────────────
select throws_ok(
  $$insert into public.bids (shoot_id, photographer_id, amount_chf, message)
    values ('10000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002', 3900, 'Zweites Angebot.')$$,
  '23505',
  null,
  'one bid per photographer per shoot'
);

-- ── 12: photographer cannot accept a bid ─────────────────────────────
select throws_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-000000000001')$$,
  'P0001',
  'not your shoot',
  'only the shoot client can accept'
);
reset role;

-- ── 13–16: owner accepts → full state transition ─────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.accept_bid('20000000-0000-0000-0000-000000000001')$$,
  'client accepts Markos bid'
);

select results_eq(
  $$select status::text from public.bids where id = '20000000-0000-0000-0000-000000000001'$$,
  array['accepted'],
  'accepted bid is accepted'
);

select results_eq(
  $$select status::text from public.bids where id = '20000000-0000-0000-0000-000000000002'$$,
  array['declined'],
  'sibling pending bid auto-declined'
);

select results_eq(
  $$select status::text || ':' || accepted_bid_id::text
    from public.shoots where id = '10000000-0000-0000-0000-000000000001'$$,
  array['assigned:20000000-0000-0000-0000-000000000001'],
  'shoot assigned with accepted_bid_id set'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run the tests**

Run: `npx supabase test db`
Expected: `rls.test.sql .. ok` — 16/16 pass. If a `throws_ok` message differs (Postgres versions vary slightly in quoting), adjust the expected message to the actual error text — but a deny case must still throw.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(db): pgTAP coverage for RLS matrix and accept_bid"
```

---

## Task 9: Seed data for development

**Files:**
- Create: `supabase/seed.sql`

Realistic Swiss data from the prototype so every developer (and Plan 2–5 work) has something to look at. `supabase db reset` runs it automatically. Password for all dev users: `password123`.

- [ ] **Step 1: Create `supabase/seed.sql`:**

```sql
-- Dev seed. Users all have password "password123".
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lena@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Lena & Tobias K.","locale":"de"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'vitra@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"client","display_name":"Vitra AG","locale":"de"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'marko@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"photographer","display_name":"Marko Brunner","locale":"de"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'claire@example.ch',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"role":"photographer","display_name":"Claire Dubois","locale":"fr"}', now(), now());

update public.profiles set city = 'Zürich', canton = 'ZH'
  where id = 'a0000000-0000-0000-0000-000000000003';
update public.profiles set city = 'Lausanne', canton = 'VD'
  where id = 'a0000000-0000-0000-0000-000000000004';

insert into public.photographer_details
  (profile_id, specialties, coverage_cantons, hourly_rate_chf)
values
  ('a0000000-0000-0000-0000-000000000003',
   '{wedding,portrait}', '{ZH,ZG,SZ,VS}', 280),
  ('a0000000-0000-0000-0000-000000000004',
   '{commercial,architecture,portrait}', '{VD,GE,FR}', 320);

insert into public.shoots
  (client_id, title, type, brief, location_city, location_postcode, canton,
   shoot_date, duration_hours, budget_min_chf, budget_max_chf)
values
  ('a0000000-0000-0000-0000-000000000001',
   'Hochzeit in Zermatt', 'wedding',
   'Trauung um 14:30 in der Bergkapelle, anschliessend Apéro auf der Terrasse mit Matterhorn-Blick. Dokumentarischer Stil — ehrlich, ruhig.',
   'Zermatt', '3920', 'VS', '2026-08-14', 10, 3200, 4500),
  ('a0000000-0000-0000-0000-000000000002',
   'Editorial — Vitra Sommerkollektion', 'commercial',
   'Indoor-Studio, klares Tageslicht, 12 Stühle, ein Sofa. Aesthetik wie der gedruckte Katalog 2024.',
   'Basel', '4051', 'BS', '2026-07-03', 6, 4800, 6200),
  ('a0000000-0000-0000-0000-000000000001',
   'Porträtserie für Forschungsteam', 'portrait',
   'EPFL Labor. 18 Personen, je 5–7 Minuten. Schwarzweiss bevorzugt.',
   'Lausanne', '1015', 'VD', '2026-07-21', 4, 1800, 2400);

insert into public.bids (shoot_id, photographer_id, amount_chf, message)
select s.id, 'a0000000-0000-0000-0000-000000000003', 3800,
       'Dokumentarischer Stil ist genau mein Ansatz — ruhig, unaufdringlich, ehrlich.'
from public.shoots s where s.title = 'Hochzeit in Zermatt';

insert into public.bids (shoot_id, photographer_id, amount_chf, message)
select s.id, 'a0000000-0000-0000-0000-000000000004', 5600,
       'Je travaille régulièrement pour des marques de mobilier — lumière naturelle maîtrisée.'
from public.shoots s where s.title = 'Editorial — Vitra Sommerkollektion';
```

- [ ] **Step 2: Reset + verify**

Run: `npx supabase db reset`
Expected: migrations + seed apply. In Studio: 4 profiles, 3 shoots, 2 bids.

Re-run `npx supabase test db` → still 16/16 (tests roll back, fixtures use different UUIDs).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): development seed with Swiss sample data"
```

---

## Task 10: Landing page with live shoots

**Files:**
- Create: `src/components/shoot-card.tsx`, `src/components/locale-switcher.tsx`
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Create `src/components/shoot-card.tsx`:**

```tsx
import { getTranslations } from "next-intl/server";
import { formatCHFRange, formatSwissDate } from "@/lib/format";

export type ShootCardData = {
  id: string;
  title: string;
  type: string;
  location_city: string;
  canton: string;
  shoot_date: string;
  duration_hours: number;
  budget_min_chf: number;
  budget_max_chf: number;
};

export async function ShootCard({ shoot }: { shoot: ShootCardData }) {
  const t = await getTranslations("shoot");
  return (
    <article className="border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="label text-mute">{t(`types.${shoot.type}`)}</span>
        <span className="label text-accent">{t("statusOpen")}</span>
      </div>
      <h3 className="mt-2 text-lg font-medium tracking-tight">{shoot.title}</h3>
      <dl className="mt-3 space-y-1 text-sm text-mute">
        <div className="flex justify-between">
          <dt>{t("location")}</dt>
          <dd className="text-ink">
            {shoot.location_city}, {shoot.canton}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("date")}</dt>
          <dd className="text-ink tabular">{formatSwissDate(shoot.shoot_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{t("budget")}</dt>
          <dd className="text-ink tabular">
            {formatCHFRange(shoot.budget_min_chf, shoot.budget_max_chf)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
```

- [ ] **Step 2: Create `src/components/locale-switcher.tsx`:**

```tsx
"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="flex gap-3">
      {routing.locales.map((l) => (
        <button
          key={l}
          onClick={() => router.replace(pathname, { locale: l })}
          className={`label press ${l === locale ? "text-ink" : "text-mute-2"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 3: Replace `src/app/[locale]/page.tsx`:**

```tsx
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ShootCard, type ShootCardData } from "@/components/shoot-card";
import { createClient } from "@/lib/supabase/server";

// Live marketplace data; revisit caching strategy in Plan 5.
export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTranslations("landing");
  const supabase = await createClient();

  const { data: shoots } = await supabase
    .from("shoots")
    .select(
      "id,title,type,location_city,canton,shoot_date,duration_hours,budget_min_chf,budget_max_chf"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-medium tracking-tight">Rintakez</span>
        <LocaleSwitcher />
      </header>
      <div className="h-px bg-line" />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="max-w-2xl text-4xl font-medium tracking-tight md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-4 max-w-xl text-mute">{t("subtitle")}</p>
        <button className="press mt-8 bg-ink px-6 py-3 text-paper">
          {t("cta")}
        </button>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="label text-mute">{t("latestShoots")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(shoots ?? []).map((s) => (
            <ShootCard key={s.id} shoot={s as ShootCardData} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Verify in all three locales**

Run: `npm run dev` (Supabase must be running: `npm run db:start`).
- `/de`: hero in German, 3 seeded shoots render with `CHF 3'200 – 4'500` style budgets and `14.08.2026` dates.
- `/fr`, `/en`: switcher works, cards translate type/status labels.
- Mobile check: narrow the window to ~390px — single-column grid, no horizontal scroll.

- [ ] **Step 5: Build + tests green, commit**

Run: `npm run build && npx vitest run`

```bash
git add -A && git commit -m "feat: trilingual landing page with live open shoots"
```

---

## Task 11: CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  app:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-dummy-key
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npx vitest run
      - run: npm run build

  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: supabase start
      - run: supabase test db
```

Note: `npm run build` succeeds with dummy env because the landing page is `force-dynamic` — Supabase is only contacted at request time, not build time.

- [ ] **Step 2: Verify locally what CI runs**

Run: `npm run lint && npm run typecheck && npx vitest run && npm run build && npx supabase test db`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: lint, typecheck, unit tests, build, db tests"
```

---

## Task 12: Production setup & first deploy (checklist)

No code — operational steps. Do these together with the owner (accounts needed).

- [ ] **Step 1: GitHub** — create a private repo `rintakez`, then:

```bash
git remote add origin git@github.com:<owner>/rintakez.git
git push -u origin main
```

Verify: CI runs green on GitHub Actions.

- [ ] **Step 2: Supabase production project** — at supabase.com create project `rintakez-prod`, **region: Zurich (aws eu-central-2)**, strong DB password (store in a password manager). Then link and push the schema:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Verify in the Supabase dashboard: tables + policies present. **Do not run seed.sql against production.**

- [ ] **Step 3: Vercel** — import the GitHub repo at vercel.com. Framework auto-detects Next.js. Set env vars (Production + Preview) from the Supabase project's API settings:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

  In Project Settings → Functions, set region `fra1` (Frankfurt — closest to Zürich).

- [ ] **Step 4: Verify deployment** — open the production URL: landing renders in `/de`, `/fr`, `/en` (shoot list empty — prod has no data; that's correct).

- [ ] **Step 5: Tag the milestone**

```bash
git tag v0.1.0-foundation && git push --tags
```

---

## Done = 

- All 12 tasks committed; CI green on GitHub.
- `supabase test db` → 16/16 RLS assertions pass.
- Production URL serves the trilingual themed landing page from the Zürich-region database.
- Next: Plan 2 (auth & onboarding) gets written against this foundation.
