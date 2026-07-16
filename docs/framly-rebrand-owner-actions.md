# Framly rebrand — owner actions (outside code)

The code rebrand (Rintakez → Framly, framly.ch) lives on branch
`chore/rebrand-framly`. These remaining items are **not code** — they are
account/DNS/asset actions only the owner can do. None blocks local dev; all
block a clean public launch under the new brand.

## Legal (confirmed decision: Framly = trade name only)

- The **Einzelfirma stays** "Rinor Mustafi – Rintakez", UID CHE-466.681.384.
  The Impressum operator identity was **left verbatim on purpose** — restating
  it as "Framly" would be a false legal declaration.
- Recommended (ask your Treuhänder/jurist): add one line to the Impressum such
  as "Betreiber der Plattform Framly (framly.ch)" so the registered entity and
  the trade name are clearly linked. This is a wording decision, not a find-replace.
- If you later register the firm itself as Framly at the Handelsregister, the UID
  may change — then the Impressum body + UID get updated to the new record.

## Domain & hosting

- Point **framly.ch** DNS at Vercel; add it as the project's primary domain.
- Set `NEXT_PUBLIC_SITE_URL=https://framly.ch` in Vercel env (drives canonical,
  hreflang, sitemap, robots, OG URLs). `.env.example` already shows framly.ch.
- Optional: redirect the old rintakez.ch (if you still hold it) → framly.ch 301,
  so existing links and SEO transfer.

## Email addresses (client created these)

| Address | Role in the product | Status |
|---|---|---|
| `info@framly.ch` | Impressum + Datenschutz (revDSG) contact | **Wired in code** — replaced a personal Hotmail |
| `noreply@framly.ch` | `EMAIL_FROM` transactional sender | Set the Vercel env after Resend verifies framly.ch |
| `admin@framly.ch` | Platform admin login (seeded) + future `admin_alert` recipient | Login ready; the alert template exists but isn't wired to a trigger yet |
| `itsupport@framly.ch` | Technical support | No home in code yet — candidate for a support link / error-boundary contact later |

The `admin_alert` email template (`src/lib/email.ts`) is built but never dispatched
— when that gets wired, `admin@framly.ch` is the natural recipient.

## Email (Resend)

- Verify the **framly.ch** sending domain in Resend: add its SPF + DKIM DNS
  records, or mail lands in spam.
- Set `EMAIL_FROM="Framly <noreply@framly.ch>"` in Vercel env (code default now
  says Framly; the address must be a verified framly.ch sender).

## Stripe

- **Statement descriptor** → `FRAMLY` (this is what shows on the customer's bank
  statement; currently planned as RINTAKEZ). Dashboard → Settings → Public details.
- Product/price display names and receipt/Portal branding → Framly.
- No code change: price IDs are read from `STRIPE_PRICE_*` env and are opaque.

## Supabase

- Auth **email templates** (confirmation, recovery, magic link) hardcode the
  project/brand name in their copy — update them to Framly in the dashboard.
- Optional: rename the Supabase project to Framly (cosmetic; the local
  `project_id = "rintakez-v2-4"` was intentionally left — changing it re-links
  the local CLI and renames the working dir for no user benefit).

## Assets (design)

- New **logo / wordmark** as "Framly." (the terracotta-period mark is generated
  by `src/components/wordmark.tsx`, so the web wordmark already reads Framly).
- New **favicon** and **PWA icons** (`public/`), and the OG image if it uses a
  logo file. The dynamic OG route already renders the text "Framly".
- Social handles / profile art for the Framly brand.

## Repo / project (optional, cosmetic)

- GitHub repo `Hadiademi/Rintakez` → rename to Framly (updates the remote URL).
- Vercel project name → Framly.

## Intentionally left as internal identifiers (do NOT "fix" naively)

- Postgres GUC `rintakez.reopen_orphan` — set in a SECURITY DEFINER function and
  read in the booking-integrity guard, both inside an **already-applied**
  migration. Renaming needs a *new* migration and breaks the guard if only one
  side changes. Invisible to users. Leave it.
- `rintakez:shoot-draft:` localStorage key — renaming orphans users' saved shoot
  drafts. Invisible. Leave it.
- ICS `UID:…@rintakez` — opaque calendar UID domain part. Leave it.
- `supabase/config.toml` `project_id` — local ref. Leave it.

## Verification already done on the branch

typecheck (`framly@0.1.0`), lint 0 errors, vitest 330, i18n parity 833×3,
`check:legal` (no placeholders), `next build`. `admin@framly.ch` verified to
authenticate with `is_admin=true` via the auth API — the exact seed↔e2e-helper
coupling. Full Playwright suite not run here because local port 3000 was
occupied by an unrelated Docker container (environment, not the rebrand);
run `npx playwright test` once 3000 is free.
