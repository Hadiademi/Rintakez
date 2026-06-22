# Rintakez — Operations Runbook

Operational reference for running Rintakez in production (Vercel + Supabase,
Zürich region). Pairs with the launch runbook in `docs/superpowers/plans/`.

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted server work (admin actions, email outbox, account deletion) | yes |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails | prod |
| `RESEND_API_KEY` / `EMAIL_FROM` | Notification email delivery (gated; inert if unset) | optional |
| `CRON_SECRET` | Authorizes `/api/cron/process` (Vercel Cron sends it as a Bearer token) | prod |
| `ERROR_WEBHOOK_URL` | Error sink — point at Sentry/Logflare/Slack ingestion (gated) | optional |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Cookieless analytics (gated) | optional |

## Scheduled jobs (Vercel Cron)

`vercel.json` schedules `GET /api/cron/process` every 5 minutes. It:
- drains the durable **email outbox** (`drainEmailOutbox`), sending pending
  notification emails with a timeout and up to 5 retries per row.

The route 503s if `CRON_SECRET` is unset and 401s on a wrong/missing token, so it
cannot be triggered externally. To run manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/process
```

Stale open shoots (past `shoot_date`) need no job: they are filtered from the
browse and refused new bids at the RLS layer.

## Error monitoring

`captureError()` (`src/lib/observability.ts`) always logs structured JSON and,
when `ERROR_WEBHOOK_URL` is set, forwards the event to that sink. Point it at a
Sentry/Logflare/Slack endpoint. The call sites are stable, so swapping in the
full `@sentry/nextjs` SDK later is a drop-in at this seam.

## Audit log

Sensitive admin/destructive actions are recorded in `public.audit_log`
(service-role only): user/shoot suspension, photographer verification decisions,
report resolution, account deletion. Query via the Supabase dashboard for dispute
or compliance investigations.

## Backups & restore

- Enable **Supabase Point-in-Time Recovery** (Pro plan) — daily automated
  backups, ≥7-day retention.
- Quarterly: take a manual logical dump as an off-site copy and rehearse a
  restore into a scratch project:
  ```bash
  supabase db dump --db-url "$PROD_DB_URL" -f backup-$(date +%F).sql
  ```
- Target RPO ≤ 24h, RTO ≤ 4h. Record the last successful restore drill date here.

## Incident & data-breach response (revFADP Art. 24 / GDPR Art. 33)

1. Contain: rotate keys (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`), suspend
   abusive accounts via the admin panel.
2. Assess scope using `audit_log` and Supabase/Vercel logs.
3. If personal data is affected and risk is non-negligible, notify the EDÖB
   within 72h and affected users without undue delay.
4. Write a post-mortem; file follow-up hardening tasks.

## Routine operator tasks

- **Grant admin:** `update profiles set is_admin = true where id = '<uuid>';`
- **After any migration:** run `npm run db:types` and commit the regenerated
  `src/lib/supabase/database.types.ts` (hand-authored; keep it in sync with the
  schema — CI runs `typecheck` but cannot auto-diff generated types here).
- **Moderation:** suspend users/shoots and resolve reports from `/admin`.
- **Verification:** approve/reject photographer verification from `/admin`.
