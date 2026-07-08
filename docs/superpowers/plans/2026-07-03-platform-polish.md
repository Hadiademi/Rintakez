# Platform Polish Implementation Plan (Sprints 1–3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (implementer subagent + reviewer subagent per task, final whole-branch review). This document is SELF-CONTAINED — it was written to be executed in a fresh session with no prior context.

**Goal:** Take Rintakez from "solid app" to "real production platform" — UI/UX and features only. **Payment/Stripe/billing is explicitly OUT OF SCOPE** (deferred by owner decision; subscriptions will be web-only Stripe later — never add plan-gating, paywalls, or purchase UI in these sprints).

**Origin:** Senior UI/UX review on 2026-07-02/03: live visual inspection (desktop 1440px + mobile 390px via Playwright) + 3-lens chat-UX code audit + platform audit. The chat overhaul itself is already DONE (branch `feat/chat-ux`, verdict READY TO MERGE): optimistic send, smart scroll, grouping, read receipts, day labels, live inbox, pagination, viewport/keyboard foundations. THIS plan is what comes NEXT.

---

## Context a fresh session needs

**Product:** Two-sided Swiss photography/videography marketplace. Clients post shoots (type, canton, date, budget) → photographers bid → client accepts → in-app chat opens → shoot completes → client reviews. Trilingual **de/fr/en** via next-intl. Mobile-first **PWA**.

**Stack:** Next.js 16 App Router + React 19 + TypeScript, Supabase (Postgres/Auth/RLS/Storage/Realtime, local dev via `supabase start`), Tailwind v4 (design tokens in `src/app/globals.css`: `bg-paper/surface/chip`, `text-ink/mute/mute-2`, `border-line`, `text-accent` terracotta, `.press`, `.label`), Vitest, pgTAP (`npm run db:test`), Playwright e2e.

**Repo state (2026-07-03):** branch `feat/chat-ux` holds the finished chat work (7 commits over `main`; final review READY TO MERGE — merge it to main before or at the start of Sprint 1). `main` already contains: launch-hardening (matched-shoot email alerts, lifecycle emails, invite-photographer feature, trust signals, SEO incl. canton×type landing pages, profile-view counters, admin liquidity metrics) and the mobile-ready backend prep.

**Dev environment:**
- `supabase start` (Docker), then `npm run dev` → http://localhost:3000.
- Seed logins (password `password123`): client `lena@example.ch`, photographer `marko@example.ch`, also `vitra@example.ch` (client), `claire@example.ch` (photographer). Seeded conversation exists between Lena and Marko.
- Gates after EVERY task: `npm run typecheck && npm run lint && npm run build && npx vitest run` (60 tests incl. i18n key-parity) all green; if DB touched: `npm run db:reset && npm run db:test` — ONLY the 5 known-stale pre-existing failures are acceptable (messaging_reviews t10; rls t49,53,54,55). Types regen: `SUPABASE_ACCESS_TOKEN=local npm run db:types`.
- Visual verification: use Playwright MCP — screenshot at **390×844 (mobile) AND 1440×900 (desktop)** for every UI task before calling it done.

## Global constraints (bind every task)

1. **MOBILE PARITY IS MANDATORY.** Every feature must be designed for 390px first and verified there. The app has a fixed `MobileTabBar` (bottom, safe-area aware) — new bottom-anchored UI must clear it. Tap targets ≥44px. Text inputs ≥16px on touch (iOS zoom). Test with the fixed tab bar + on-screen keyboard in mind (`viewport` export with `viewportFit: "cover"` + `interactiveWidget: "resizes-content"` already exists in `src/app/[locale]/layout.tsx`).
2. **NO payment/billing/plan-gating code.** No Stripe, no "Pro" gates, no upgrade CTAs.
3. **i18n:** every user-visible string in ALL THREE of `src/i18n/messages/{de,en,fr}.json`; French uses informal **tu** (never "vous"); the vitest suite enforces key parity across locales.
4. **Conventions:** server actions in `src/lib/actions/*` (`"use server"` files may ONLY export async functions — constants/types go in `src/lib/validation/*` or `src/lib/*`; this bug bit us twice). Reusable logic → `src/lib/core/*` (framework-agnostic, takes a Supabase client). DB security: RLS on every new table; notifications only via SECURITY DEFINER triggers; SECURITY DEFINER functions always `set search_path = public`. Emails via the durable outbox (`src/lib/email.ts` EmailKind pattern + cron drainer).
5. **Design language:** match existing tokens/components (`src/components/ui/*`: Avatar, Button, Skeleton, Spinner, EmptyState, ImageLightbox…). Editorial, restrained, no new color systems.
6. Each task: TDD where testable (pgTAP for DB, Vitest for pure logic), commit per task, reviewer subagent per task, final whole-branch review per sprint.

---

# SPRINT 1 — Chat completeness + flow polish (highest perceived-quality jump)

## Task S1.1 — Photo attachments in chat 📷 (flagship)
**Why:** a photography marketplace whose chat can't carry photos pushes users to WhatsApp. Photographers share previews/moodboards; clients share references.
**Files:** new migration (message_attachments or an `image_path` column approach), `src/lib/actions/messages.ts`, `src/components/message-thread.tsx`, storage bucket.
**Spec:**
- Storage: new **private** Supabase Storage bucket `message-images` (NOT public — chat images are private). Path convention `conversationId/<uuid>.<ext>`. Storage RLS: only conversation participants can read/write (mirror how `portfolio`/`avatars` buckets are configured in migrations; participants check via the conversations table).
- DB: simplest robust model — add nullable `image_path text` to `public.messages` (a message is text, image, or image+caption where `body` is the caption; keep `body` NOT NULL by allowing empty string for image-only, or relax constraint — check the existing CHECK on body length and adjust in a migration with pgTAP).
- Send flow: composer gets an attach button (📎/image icon, ≥44px) → file picker (accept image/*, mobile camera roll works via standard input) → client-side downscale to max ~2000px / ~85% JPEG before upload (canvas; keeps uploads fast on mobile data) → upload to storage → send message with `image_path`. Show upload progress state on the optimistic bubble (reuse the existing `sending` status machinery).
- Render: image bubbles (max-width same as text bubbles, rounded, `aspect` preserved via width/height, blur-up or skeleton while loading, `loading="lazy"`), tap → existing `ImageLightbox`. Signed URLs (bucket is private): generate short-lived signed URLs server-side in `getThread`/`loadEarlierMessages` (and for realtime incoming, fetch a signed URL client-side via a small server action).
- Limits & safety: max 5MB post-compression, images only (validate MIME server-side too), rate-limit reuses the existing message rate limit. Blocked users can't send (existing policy covers inserts).
- Email mirror: `message_received` email already exists; no image in email — fine, the notification text works.
- **Mobile:** attach button reachable next to the composer without crowding (icon-only); picker = native sheet; upload progress visible; keyboard stays usable.
- pgTAP: participant can insert message with image_path; non-participant storage access denied (if storage policies are testable — otherwise document manual check); message with empty body + image allowed; body-only unchanged.
**Acceptance:** send a photo from mobile viewport (390px) and desktop; bubble shows progress → image; lightbox opens; recipient sees it live (realtime); non-participant cannot fetch the storage object.

## Task S1.2 — Shoot status stepper (visual timeline)
**Why:** "I always know where I am" — hallmark of production apps.
**Files:** new `src/components/shoot-stepper.tsx`, wire into `src/app/[locale]/(app)/shoots/[id]/page.tsx` (and optionally my-shoots rows).
**Spec:** horizontal stepper `Offen → Vergeben → Abgeschlossen → Bewertet` (localized; map from shoot.status + whether a review exists — the page already loads both). Current step accented (`text-accent`/`bg-ink`), done steps checkmarked, future muted. Under the stepper, one contextual next-action line for the viewer's role: client with 0 bids → link to invite photographers (exists); assigned client → contact + complete CTA (exist); completed unreviewed client → review CTA (exists). Cancelled shoots show a distinct terminal state, not the stepper.
**Mobile:** compact variant — 4 dots + labels that don't wrap awkwardly at 390px (labels under dots, smaller text, or icons+short labels). NO horizontal scroll.
**Acceptance:** stepper renders correctly for each status (open/assigned/completed/cancelled, reviewed or not) on 390px and 1440px.

## Task S1.3 — Unified toast system
**Why:** action feedback is currently scattered inline text; a consistent toast layer makes everything feel polished.
**Files:** new `src/components/ui/toaster.tsx` (context + hook `useToast()`), mount in the app layout; migrate the highest-traffic confirmations.
**Spec:** small, token-styled toasts (bg-ink text-paper, 3s auto-dismiss, dismissible, `role="status"` aria-live polite, respects reduced motion). Queue max 3. Position: **bottom-center above the MobileTabBar on mobile** (safe-area aware), bottom-right on desktop. Migrate: save profile/settings, invite sent ("Einladung gesendet" — currently inline in the picker, keep inline state too), bid submitted/withdrawn, shoot created/updated, review submitted, availability saved. Do NOT migrate form validation errors (keep those inline next to fields).
**Acceptance:** toasts appear above the tab bar at 390px, bottom-right at 1440px; screen reader announces them; existing inline error UX untouched.

## Sprint 1 exit: final whole-branch review + visual pass (both viewports) on: chat with images, a shoot detail in each status, one toast flow.

---

# SPRINT 2 — Conversion + activation

## Task S2.1 — Bid comparison for clients
**Why:** choosing between bids is THE client decision moment; today bids are a plain list.
**Files:** `src/app/[locale]/(app)/shoots/[id]/page.tsx` (owner's bid section), maybe new `src/components/bid-compare.tsx`; small extension of the bid query to join photographer trust data.
**Spec:** for the shoot owner with ≥2 pending bids, render bids as comparable cards in a grid: photographer (avatar/monogram + name + verified badge), price (tabular, prominent), rating + review count, completed shoots count (`photographer_completed_shoots_count` RPC exists), member-since, bid message (clamped, expandable), and actions (Accept / view profile / message-after-accept note). Sort control: price ↑ / rating ↓ / newest. Highlight nothing by default (no dark patterns). Keep the existing accept flow + confirmation exactly as is (`accept_bid` RPC — do NOT touch its logic).
**Mobile:** cards stack full-width; sort control as segmented chips; accept button full-width ≥44px. Avoid tables — cards only (tables break at 390px).
**Acceptance:** owner sees comparison cards + sort on both viewports; accept still works end-to-end (verify with seed users); non-owners see nothing new.

## Task S2.2 — Profile completeness meter + first-run checklist
**Why:** complete profiles win work; the directory currently shows empty monograms for new photographers.
**Files:** new `src/lib/profile-completeness.ts` (pure scorer + Vitest), new `src/components/profile-checklist.tsx`, wire into photographer home (`src/app/[locale]/(app)/home/page.tsx` photographer branch) + profile edit page.
**Spec:** score from existing data — avatar (15), bio ≥80 chars (15), ≥3 portfolio images (25, partial credit per image), hourly rate (10), coverage cantons (10), specialties (10), verification requested/approved (15). Card: progress bar (accent), "Profil: 65%", top 3 missing items as direct links to the exact edit surface. Dismissible per session at 100%… actually: auto-hide at 100%. Photographer home only (clients have no equivalent).
**Mobile:** card fits 390px, links are 44px rows.
**Vitest:** scorer unit tests (empty profile → low; full → 100; partial portfolio credit).
**Acceptance:** Marko (seed, no portfolio) sees the card with correct %; adding data raises it; hidden at 100%; renders on both viewports.

## Task S2.3 — Notifications page (`/notifications`)
**Why:** the bell dropdown keeps only 15; a real platform has a full history.
**Files:** new `src/app/[locale]/(app)/notifications/page.tsx` (+ loading.tsx), extend `src/lib/actions/notifications.ts` (paged fetch + `markAllRead`), link from the bell footer ("Alle ansehen").
**Spec:** paginated list (30/page, "load more"), grouped by day (Heute/Gestern/date — reuse the chat's local-date labeling approach), each row: icon by type, localized text (the `notifications.*` i18n labels exist for every type), relative/absolute time, unread highlighted, row links to the same `hrefFor` destination logic as the bell (extract that mapping into a shared helper so bell + page stay consistent). "Mark all read" button. Add the route to middleware's private routes if the pattern requires it (check how /messages is gated) and to robots disallow list (`src/app/robots.ts`).
**Mobile:** rows ≥44px; works with tab bar.
**Acceptance:** full history visible, mark-all works, bell badge zeroes, both viewports.

## Task S2.4 — Photographer replies to reviews
**Why:** one-sided reviews scare the paying side; replies are standard trust UX (Airbnb/Google).
**Files:** migration (`reviews.reply text` + `reply_at timestamptz`, RLS: only the reviewed photographer may set reply, once — or editable within 30 days; keep simple: settable once, non-null check), `src/lib/actions/reviews.ts` (replyToReview action, rate-limited), profile page review list (render reply indented under the review, "Antwort von {name}"), photographer's own profile view (reply form on their reviews without one).
**pgTAP:** photographer can reply to own review once; other users denied; client cannot reply.
**Mobile:** reply form = simple textarea + button, 16px font.
**Acceptance:** Marko replies to Lena's seeded review; reply shows publicly on his profile on both viewports; second reply blocked.

## Sprint 2 exit: final review + visual pass.

---

# SPRINT 3 — Depth & polish

## Task S3.1 — Global search
**Why:** nav search currently only searches open shoots.
**Spec:** `src/components/nav-search.tsx` → typeahead dropdown querying BOTH photographers (name, public profiles) and open shoots (title), grouped results with headers, keyboard navigable (↓↑ Enter Esc), debounced 250ms, min 2 chars. Server action or public-client query (photographers are public; shoots open-only). On mobile the search lives where it does today (verify: nav-search placement at 390px — if hidden on mobile, add it to the photographers/shoots pages' existing filters instead and note it). Highlight matched substring. No new tables — ILIKE on the existing indexes is fine at current scale (add trigram index only if measurably slow; don't pre-optimize).
**Acceptance:** typing "mar" surfaces Marko + any matching shoots; keyboard + touch selection works.

## Task S3.2 — Portfolio UX pro
**Spec:** in the photographer's portfolio editor (`src/components/portfolio-editor.tsx`): drag-and-drop reorder persisting `sort_order` (column exists; add a small update action; on touch use long-press drag or up/down buttons — MUST work at 390px, test it), optional caption per image (migration: `portfolio_images.caption text`, shown in lightbox), blur-up placeholders (store a tiny base64 or just skeleton shimmer — keep simple: skeleton is acceptable), and ensure directory/profile cards prefer the cover image (`cover_path` exists) with graceful monogram fallback (already done for avatars).
**Acceptance:** reorder persists after reload (mouse AND touch), captions display in lightbox, no layout shift while images load.

## Task S3.3 — PWA install + offline polish
**Spec:** custom install prompt component (listens `beforeinstallprompt`, shows a dismissible, token-styled banner/button on repeat visits — frequency-capped via localStorage, never nags), verify manifest icons/splash/name (`public/manifest.json`), designed offline fallback page served by the existing hand-written service worker (branded, "Du bist offline — deine Nachrichten warten auf dich", retry button). iOS: since no beforeinstallprompt, show a one-time "Add to Home Screen" hint with the share-icon instructions (detect iOS Safari + not standalone).
**Acceptance:** Lighthouse PWA installable; offline page renders when network cut; prompt appears capped and dismissible on both platforms' logic paths.

## Task S3.4 — Shoot wizard draft autosave
**Spec:** `new-shoot-form.tsx`: persist wizard state to localStorage (key per user, debounced), restore on return with a subtle "Entwurf wiederhergestellt" notice + discard option, clear on successful submit. Exclude image uploads from the draft (references note). 16px inputs on touch already? — verify while in the file (iOS zoom rule).
**Acceptance:** fill step 2, refresh, state restored; submit clears draft.

## Task S3.5 — Positive availability calendar on the public profile
**Spec:** replace/augment the "unavailable dates" chip list on `photographers/[id]` with a compact month-grid calendar: available days neutral, unavailable struck/muted, today outlined; month nav arrows (≥44px). Read-only, data already loaded (`photographer_unavailable`). Keep the chips as fallback for no-JS/SEO if trivial, else drop them.
**Mobile:** calendar fits 390px (7 cols × ~44px = 308px ✓).
**Acceptance:** seeded unavailable dates render struck; month nav works on touch; invite picker's date gray-out (existing) unaffected.

## Task S3.6 — Tracked follow-ups (small, do in one batch)
- `shoots.completed_at` set inside `complete_shoot()` (migration + use it in the review_request lifecycle scan instead of created_at proxy). pgTAP.
- Admin reports list: resolve review/message `target_id` to a content snippet (service-role lookup) instead of raw UUID.
- Read-receipt liveness: subscribe to conversation UPDATE (last-read columns) in the open thread so ✓→✓✓ flips live (small; the thread already has a channel — add a `postgres_changes` UPDATE listener on the conversation row).
- `MessagesLive`: skip `router.refresh()` when the insert belongs to the currently open conversation (pass pathname/conversationId in).
- Fix the 5 stale pgTAP tests (messaging_reviews t10 → use `mark_conversation_read()`; rls t49/53-55 → date-shift fixtures) so `db:test` is finally fully green.
- OAuth signups: fire the `signup` Plausible event on the auth callback landing (first-session detection) so Google signups are counted.

## Sprint 3 exit: final whole-branch review + full visual regression pass (both viewports, light + dark mode) across: home, directory, profile, shoot detail (all statuses), wizard, messages (text + image), notifications, search.

---

## Execution notes for the fresh session
- Work branch per sprint: `feat/platform-polish-s1` (then s2, s3), off `main` AFTER merging `feat/chat-ux`.
- Keep the SDD ledger at `.superpowers/sdd/progress.md` (gitignored) — append per task; it is the recovery map after compaction.
- Implementer prompts must include: the task spec verbatim, the global constraints above, the gates, and "write report to .superpowers/sdd/<task>-report.md; return only status/commit/summary/concerns".
- Reviewer per task; fix-loop until approved; controller may self-verify trivial diffs.
- Visual verification with Playwright MCP at 390×844 AND 1440×900 is part of DONE for every UI task (dev server: `supabase start` + `npm run dev`; login as seed users above).
- If `npm run dev` serves broken chunks: kill ALL next processes (`pkill -f next`), `rm -rf .next`, restart — stale prod build artifacts in `.next` caused this before.
