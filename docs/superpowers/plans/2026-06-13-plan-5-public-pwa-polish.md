# Rintakez Plan 5: Public Pages, PWA & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the app launch-presentable: public photographer profiles, error-code mapping for action UX, dark mode, error/empty/loading states, per-locale SEO (metadata + sitemap + robots), legal pages (Impressum + Datenschutz, DE/FR/EN — required for a Swiss launch), and PWA install (manifest + service worker) — spec phase 6.

**Architecture:** RSC public pages readable by anonymous users (RLS already exposes profiles/photographer_details/portfolio_images to everyone). A small client `ThemeToggle` persists theme to `localStorage` and sets `data-theme` on `<html>`. Action error codes mapped to localized messages via a shared helper. PWA via `@serwist/next`.

**Tech Stack:** Next.js 16 App Router, next-intl, Tailwind theme tokens, @serwist/next, Playwright.

**Builds on:** Plan 4 (v0.4.0). Theme tokens (light+dark) exist in globals.css; the app shell, landing, and all flows work. Public photographer-profile links already point at `/photographers/<id>` (currently 404).

**Branch:** `feat/plan-5-polish`.

---

## Conventions: same as prior plans (locale-aware nav; symmetric i18n; data-testid; full-matrix green per task).

---

## Task 1: Action error-code mapping (deferred from Plans 3–4)

**Files:** Create `src/lib/error-messages.ts`; add an `errors` message namespace; update components that surface raw `error` strings (bid-sheet, my-bid-panel, bid-card, cancel-shoot-button, register-form, login-form, onboarding-form, new-shoot-form).

- [ ] **Step 1: Add `errors` namespace** to all three catalogs with keys for every known action error code plus a fallback: `invalid_input`, `unauthorized`, `forbidden`, `already_bid`, `not_found`, `limit_reached`, `invalid_file`, `generic`. DE/FR/EN values, e.g. `generic`: "Etwas ist schiefgelaufen."/"Une erreur est survenue."/"Something went wrong."; `already_bid`: "Du hast bereits ein Angebot abgegeben."/"Tu as déjà soumis une offre."/"You've already bid."; `unauthorized`: "Bitte melde dich an."/"Connecte-toi."/"Please log in."; `forbidden`: "Dazu hast du keine Berechtigung."/"Tu n'as pas l'autorisation."/"You're not allowed to do that."; sensible wording for the rest. Symmetric.

- [ ] **Step 2: Create `src/lib/error-messages.ts`:**

```ts
const KNOWN = new Set([
  "invalid_input",
  "unauthorized",
  "forbidden",
  "already_bid",
  "not_found",
  "limit_reached",
  "invalid_file",
]);

/** Map an action error string to a stable i18n key under the `errors` namespace.
 *  Unknown/raw DB strings collapse to `generic` so we never leak internals. */
export function errorKey(error: string): string {
  return KNOWN.has(error) ? error : "generic";
}
```

- [ ] **Step 3: Update each component** that currently renders a raw action `error` to instead show `t(errorKey(result.error))` using `useTranslations("errors")`. Keep existing field-validation messages (those are zod messages on inputs) as-is; this is only for the server-action result error surface. Where a component previously mapped `"invalid_input"` to a generic message inline, replace with the helper.

- [ ] **Step 4:** Full matrix green (lint, typecheck, vitest, build). Add a tiny unit test `src/lib/error-messages.test.ts` (known code passes through; unknown/raw DB string → "generic"). Commit: `git commit -m "feat: map action errors to stable localized codes (no raw DB leak)"`.

---

## Task 2: Public photographer profile

**Files:** Create `src/app/[locale]/(public)/photographers/[id]/page.tsx`, `src/components/portfolio-grid.tsx`; add `profile` keys.

Anonymous-readable (RLS exposes profiles, photographer_details, portfolio_images to everyone). This is what the `/photographers/<id>` links across the app point to.

- [ ] **Step 1: Add keys** under `profile`: `specialties` ("Spezialgebiete"/"Spécialités"/"Specialties"), `coverage` ("Einsatzgebiete"/"Régions"/"Coverage"), `hourlyRate` ("Stundensatz"/"Tarif horaire"/"Hourly rate"), `portfolio` ("Portfolio"/"Portfolio"/"Portfolio"), `noPortfolio` ("Noch keine Bilder."/"Pas encore d'images."/"No images yet."), `website` ("Website"/"Site web"/"Website"), `instagram` ("Instagram"/"Instagram"/"Instagram"), `notPhotographer` ("Profil nicht gefunden."/"Profil introuvable."/"Profile not found."). Symmetric.

- [ ] **Step 2: Create `portfolio-grid.tsx`** (server component): props `{ images: { id: string; url: string }[] }`. A responsive masonry-ish grid (CSS columns or grid) of `<img>` (plain img to avoid optimizer config for the storage host) with `loading="lazy"`, rounded, object-cover. Empty → render nothing (caller shows the empty text).

- [ ] **Step 3: Create `photographers/[id]/page.tsx`** (server): await params.id. Fetch the profile: `from("profiles").select("id, display_name, role, city, canton, bio, avatar_url").eq("id", id).maybeSingle()`. If not found OR role !== "photographer" → `notFound()`. Fetch `photographer_details` (specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url) and `portfolio_images` (id, storage_path ordered by sort_order, created_at). Build public URLs via `supabase.storage.from("portfolio").getPublicUrl(storage_path).data.publicUrl`. Render: a header with avatar (if any), display_name, city+canton, bio; a details section with specialties (localized via `shoot.types.*`), coverage cantons (codes), hourly rate (formatCHF if present), website/instagram links; then `<PortfolioGrid images={...}/>` or the noPortfolio text. Use `generateMetadata` for per-profile title/description (see Task 4 pattern). The page must render for ANONYMOUS users (it's under (public)); do not call auth-gated helpers.

- [ ] **Step 4: Verify** anonymously (no login): `/de/photographers/<marko-id>` (get his id from DB) renders his name, specialties, and seeded data. `/de/photographers/<a-client-id>` → 404. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: public photographer profile pages"`.

---

## Task 3: Dark mode toggle + theme persistence

**Files:** Create `src/components/theme-toggle.tsx`, `src/components/theme-script.tsx`; modify `src/app/[locale]/layout.tsx`; add `theme` keys; place the toggle in app nav + landing header.

The tokens already switch on `<html data-theme>`. We add a no-flash inline script that applies the saved theme before paint, plus a toggle.

- [ ] **Step 1: Create `theme-script.tsx`** — a component returning a `<script>` with `dangerouslySetInnerHTML` that reads `localStorage.getItem("theme")` (fallback to `matchMedia('(prefers-color-scheme: dark)')`) and sets `document.documentElement.setAttribute('data-theme', …)` synchronously. Render it in `<head>` (or at the top of `<body>`) in the locale layout so there's no flash. Keep the server-rendered default `data-theme="light"` on `<html>`; the script corrects it pre-paint.

- [ ] **Step 2: Create `theme-toggle.tsx`** (client): a button toggling between light/dark. On click: compute next theme, `document.documentElement.setAttribute('data-theme', next)`, `localStorage.setItem('theme', next)`, and `useState` to reflect the icon/label. Initialize state from the current `data-theme` (read in a useEffect to avoid hydration mismatch). Sun/moon glyph (inline SVG) + sr-only label `t("toggle")`. data-testid `theme-toggle`. Add `theme` namespace: `toggle` ("Theme wechseln"/"Changer de thème"/"Toggle theme"), `light` ("Hell"/"Clair"/"Light"), `dark` ("Dunkel"/"Sombre"/"Dark"). Symmetric.

- [ ] **Step 3: Wire it in** — render `<ThemeScript/>` in `src/app/[locale]/layout.tsx`. Add `<ThemeToggle/>` next to the LocaleSwitcher in `src/components/app-nav.tsx` and in the landing header (`src/app/[locale]/page.tsx`).

- [ ] **Step 4: Verify** dev server: toggling flips the palette and persists across reload (no flash on reload). Check a couple of pages render correctly in dark (landing, a shoot card, the app shell). Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: dark mode toggle with persisted, no-flash theme"`.

---

## Task 4: SEO — metadata, sitemap, robots

**Files:** Modify `src/app/[locale]/layout.tsx` (+ `generateMetadata` on key pages); Create `src/app/sitemap.ts`, `src/app/robots.ts`; add `meta` keys.

- [ ] **Step 1: Per-locale root metadata.** In `src/app/[locale]/layout.tsx`, replace the static `metadata` export with `generateMetadata({ params })` that awaits the locale, pulls a localized title/description from a new `meta` namespace (`title`, `description`, `ogTitle`), sets `metadataBase` (use `process.env.NEXT_PUBLIC_SITE_URL` fallback `http://localhost:3000`), `alternates.languages` mapping de/fr/en to `/de`,`/fr`,`/en`, and OpenGraph (title, description, locale, type website). Add the `meta` namespace to all three catalogs with sensible Swiss-marketplace copy.

- [ ] **Step 2: Landing + photographer-profile metadata.** Give `src/app/[locale]/page.tsx` a `generateMetadata` (localized landing title/description). The photographer profile (Task 2) gets `generateMetadata` returning the photographer's name + a short description (e.g. "{name} — Fotograf:in in {city}").

- [ ] **Step 3: `src/app/sitemap.ts`** — export default an async function returning entries for the static public routes per locale (`/`, `/login`, `/register`, plus `/de|/fr|/en` variants) and dynamically the public photographer profiles (`from("profiles").select("id").eq("role","photographer")` via a server Supabase client — use the anon client; it's build/runtime safe). Use `metadataBase` URL. Set `alternates.languages` per entry if practical, else list each locale URL.

- [ ] **Step 4: `src/app/robots.ts`** — allow all, point `sitemap` to `${SITE_URL}/sitemap.xml`, and `disallow` the authenticated areas (`/de/home`, `/fr/home`, `/en/home`, `/*/my-shoots`, `/*/my-bids`, `/*/onboarding`, `/*/settings`, `/*/profile`) — express with path prefixes Next supports (you can disallow `/home`, `/my-shoots`, etc. without the locale and also the localized variants; keep it reasonable).

- [ ] **Step 5: Verify** — `npm run build`; check `/sitemap.xml` and `/robots.txt` are generated (they appear in the build output / can be fetched from the dev server). View-source a page to confirm `<title>`, description, and `hreflang` alternate links per locale. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: per-locale SEO metadata, sitemap, robots"`.

---

## Task 5: Legal pages (Impressum + Datenschutz)

**Files:** Create `src/app/[locale]/(public)/impressum/page.tsx`, `datenschutz/page.tsx`; add `legal` keys; add footer links.

Switzerland: an Impressum (provider identification) and a privacy policy (Datenschutzerklärung, nFADP/revDSG) are expected before launch. Provide solid placeholder content with clear TODO markers for the operator's real details (company name, address, contact) — these are legally required to be accurate, so mark them unmistakably for the owner to fill.

- [ ] **Step 1: Add `legal` namespace** to all three catalogs: `impressumTitle`, `datenschutzTitle`, `impressumBody` (or structure as sections), `datenschutzBody`, and footer link labels `impressum`, `datenschutz`. For the body, provide localized boilerplate covering: operator/contact (with `[BITTE AUSFÜLLEN]` / `[À COMPLÉTER]` / `[TO COMPLETE]` placeholders for name/address/email), data collected (account email, profile, shoots/bids), purpose, Supabase as processor + data hosted in Switzerland (Zürich region), user rights (access/rectification/deletion), and contact for data requests. Keep it factual and clearly placeholder where the operator must insert real details.

- [ ] **Step 2: Create the two pages** (server components) rendering the localized legal content in a readable prose layout (max-w-2xl, headings, paragraphs). Public, no auth.

- [ ] **Step 3: Add a shared footer** — create `src/components/site-footer.tsx` with locale-aware Links to `/impressum`, `/datenschutz`, and the locale switcher; render it on the landing page and the (public) pages (and optionally the app shell). Keep it minimal/quiet.

- [ ] **Step 4: Verify** `/de/impressum`, `/de/datenschutz` (+ fr/en) render with the placeholders clearly visible. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: Impressum and Datenschutz legal pages (DE/FR/EN)"`.

---

## Task 6: Error, empty & loading states

**Files:** Create `src/app/[locale]/error.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/[locale]/loading.tsx`, and a couple of route-level `loading.tsx` for data-heavy pages (shoots browse, my-shoots, my-bids); add `states` keys.

- [ ] **Step 1: Add `states` keys**: `errorTitle` ("Etwas ist schiefgelaufen."/…/…), `errorRetry` ("Erneut versuchen"/"Réessayer"/"Try again"), `notFoundTitle` ("Seite nicht gefunden."/"Page introuvable."/"Page not found."), `notFoundHome` ("Zur Startseite"/"Accueil"/"Home"), `loading` ("Wird geladen…"/"Chargement…"/"Loading…"). Symmetric.

- [ ] **Step 2: `error.tsx`** (client component, required by Next for error boundaries): shows errorTitle + a retry button calling `reset()`. Themed. Note: error.tsx must be a client component and can use `useTranslations`.

- [ ] **Step 3: `not-found.tsx`**: shows notFoundTitle + a Link home. (Uses getTranslations — server component.)

- [ ] **Step 4: `loading.tsx`** at the locale root and for browse/my-shoots/my-bids: a simple skeleton or the loading text, themed. Keep skeletons lightweight (a few pulsing `bg-chip` blocks).

- [ ] **Step 5: Empty states** — verify the already-built empty states (my-shoots, my-bids, browse) read well; no change needed unless missing. Ensure each data list has a sensible empty message (most already do from Plans 3–4).

- [ ] **Step 6: Verify** — trigger a 404 (`/de/shoots/nonexistent-uuid` → notFound), confirm not-found renders; confirm loading flashes on a slow nav. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: global error, not-found, and loading states"`.

---

## Task 7: PWA — installable manifest + service worker

**Files:** Install `@serwist/next`; create `src/app/manifest.ts` (or `public/manifest.webmanifest`), `src/sw.ts`; modify `next.config.ts`; add app icons to `public/`.

- [ ] **Step 1: Install** `npm install @serwist/next` and `npm install -D serwist`.

- [ ] **Step 2: `src/app/manifest.ts`** — export default a `MetadataRoute.Manifest` with name "Rintakez", short_name "Rintakez", description, `start_url: "/"`, `display: "standalone"`, `background_color`/`theme_color` matching the brand (paper `#ffffff`, accent `#c8462c`), and icons (192 + 512 png). Generate simple placeholder icons (a solid accent square with "R" or just solid color) and place them in `public/` as `icon-192.png`, `icon-512.png` — if image generation isn't available, create minimal valid PNGs via a tiny script or use an SVG-based icon referenced in the manifest (PNG strongly preferred for installability; a 1-color PNG is fine as placeholder). Mark icons as placeholder in a comment for the owner to replace.

- [ ] **Step 3: Service worker `src/sw.ts`** — minimal Serwist setup with `defaultCache`, `precacheEntries: self.__SW_MANIFEST`. Network-first for navigations is fine; do NOT cache authenticated API/data aggressively (keep it simple: precache the app shell, runtime-cache static assets). Avoid caching Supabase responses.

- [ ] **Step 4: Wire Serwist into `next.config.ts`** — wrap with `withSerwist({ swSrc: "src/sw.ts", swDest: "public/sw.js" })` composed with the existing `withNextIntl`. Order the HOFs so both apply. Ensure `npm run build` generates `public/sw.js`. Add `public/sw.js*` and Serwist build artifacts to `.gitignore`.

- [ ] **Step 5: Verify** — `npm run build` succeeds and emits the service worker; the dev/prod page serves `/manifest.webmanifest` and links it (`<link rel="manifest">` is auto-added by Next for `app/manifest.ts`). Lighthouse/Chrome "installable" criteria met (manifest + icons + SW). At minimum confirm manifest + sw.js are served and the build is green. Build/lint/typecheck/vitest green. Commit: `git commit -m "feat: PWA — installable manifest, icons, service worker"`.

---

## Task 8: Responsive app-shell nav (mobile bottom bar)

**Files:** Modify `src/components/app-nav.tsx` (or split into desktop top-bar + mobile bottom-bar).

The prototype uses a mobile bottom tab bar. Make the app shell nav responsive: desktop keeps the top bar; on small screens, show a fixed bottom tab bar with the role's primary destinations (icons + short labels) and move sign-out/locale/theme into the top bar or a simple menu.

- [ ] **Step 1:** Refactor `app-nav.tsx` so on `lg+` it renders the current top bar, and on small screens it renders: a minimal top bar (brand + theme/locale/sign-out) and a fixed bottom tab bar (`fixed bottom-0`, `bg-paper border-t border-line`, safe-area padding) with 3–4 role-based tabs using inline SVG icons + tiny labels, active state via current path (use `usePathname` from `@/i18n/navigation` in a small client subcomponent). Ensure the page content has bottom padding so it isn't hidden behind the bar on mobile. Keep all existing links/targets. data-testid `mobile-nav`.

- [ ] **Step 2: Verify** at ~390px width the bottom bar appears and navigates; at desktop width it's hidden and the top bar shows. The existing E2E (which runs in a default viewport) must still pass — make sure testids/links the specs use still resolve (they target sign-out and content, not nav layout; verify `sign-out` testid still present and reachable). Build/lint/typecheck/vitest green; run `npm run test:e2e` after `supabase db reset`. Commit: `git commit -m "feat: responsive app shell with mobile bottom tab bar"`.

---

## Task 9: Review & merge

- [ ] **Step 1:** Full matrix (reset first): lint, typecheck, vitest, build, `supabase test db`, `test:e2e` — all green.
- [ ] **Step 2:** Dispatch a review: (a) public profile pages don't leak anything beyond intended public fields (no emails, no bids — only profile + details + portfolio); (b) error pages don't leak stack traces; (c) sitemap/robots correct; (d) no raw DB error strings remain in client UI (Task 1 coverage); (e) PWA SW doesn't cache authenticated data. Fix findings.
- [ ] **Step 3:** Merge `feat/plan-5-polish` → main (`--no-ff`), tag `v0.5.0-polish`.

---

## Done =

- Public photographer profiles are live and SEO-indexed per locale; sitemap + robots in place.
- No raw DB errors reach users; all action errors show localized messages.
- Dark mode toggles and persists without flash; the app shell is responsive with a mobile bottom bar.
- Global error / not-found / loading states; legal pages (Impressum + Datenschutz) ready for the operator to finalize.
- The app is installable as a PWA.
- Next: Plan 6 (launch hardening — Lighthouse/perf, prod Supabase in Zürich, GitHub + Vercel + domain, go-live checklist — requires the owner's accounts).
