import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";

// Notification emails are durable: actions ENQUEUE into email_outbox (a fast,
// non-blocking insert via the service role), and a scheduled drainer
// (drainEmailOutbox, called from /api/cron/process) renders and sends them with
// retry. This removes the two old failure modes — silent loss on a transient
// Resend error, and the request path blocking on a slow send. With no service
// role configured, enqueue is a no-op (same graceful degradation as before).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Rintakez <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const MAX_ATTEMPTS = 5;
const SEND_TIMEOUT_MS = 8000;

export type EmailKind =
  | "bid_received"
  | "bid_accepted"
  | "bid_declined"
  | "shoot_cancelled";
type Locale = "de" | "fr" | "en";

/**
 * Enqueue the email mirror of an in-app notification. Fast, non-blocking, and a
 * no-op when the service role is not configured. Never throws into the caller.
 */
export async function notifyEmail(opts: {
  kind: EmailKind;
  recipientId: string;
  shootId?: string | null;
  shootTitle?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.from("email_outbox").insert({
      recipient_id: opts.recipientId,
      kind: opts.kind,
      shoot_id: opts.shootId ?? null,
      shoot_title: opts.shootTitle ?? null,
    });
  } catch (err) {
    // Enqueue failure must never break the originating action.
    captureError(err, { scope: "email.enqueue", kind: opts.kind });
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`resend ${res.status}: ${await res.text()}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

function link(kind: EmailKind, locale: Locale, shootId?: string | null): string {
  const path =
    (kind === "bid_received" || kind === "shoot_cancelled") && shootId
      ? `/${locale}/shoots/${shootId}`
      : `/${locale}/my-bids`;
  return `${APP_URL}${path}`;
}

const COPY: Record<
  EmailKind,
  Record<Locale, { subject: string; lead: string; cta: string }>
> = {
  bid_received: {
    de: { subject: "Neues Angebot für dein Shooting", lead: "Du hast ein neues Angebot erhalten", cta: "Angebot ansehen" },
    fr: { subject: "Nouvelle offre pour ton shooting", lead: "Tu as reçu une nouvelle offre", cta: "Voir l’offre" },
    en: { subject: "New offer for your shoot", lead: "You received a new offer", cta: "View offer" },
  },
  bid_accepted: {
    de: { subject: "Dein Angebot wurde angenommen", lead: "Glückwunsch — dein Angebot wurde angenommen", cta: "Zu meinen Angeboten" },
    fr: { subject: "Ton offre a été acceptée", lead: "Félicitations — ton offre a été acceptée", cta: "Mes offres" },
    en: { subject: "Your offer was accepted", lead: "Congratulations — your offer was accepted", cta: "Go to my offers" },
  },
  bid_declined: {
    de: { subject: "Update zu deinem Angebot", lead: "Dein Angebot wurde leider abgelehnt", cta: "Zu meinen Angeboten" },
    fr: { subject: "Mise à jour de ton offre", lead: "Ton offre a malheureusement été refusée", cta: "Mes offres" },
    en: { subject: "Update on your offer", lead: "Your offer was unfortunately declined", cta: "Go to my offers" },
  },
  shoot_cancelled: {
    de: { subject: "Ein Shooting wurde abgesagt", lead: "Ein dir zugewiesenes Shooting wurde abgesagt", cta: "Shooting ansehen" },
    fr: { subject: "Un shooting a été annulé", lead: "Un shooting qui t’était attribué a été annulé", cta: "Voir le shooting" },
    en: { subject: "A shoot was cancelled", lead: "A shoot assigned to you was cancelled", cta: "View shoot" },
  },
};

function render(
  kind: EmailKind,
  locale: Locale,
  name: string,
  shootTitle: string | null,
  url: string
): { subject: string; html: string } {
  const c = COPY[kind][locale];
  const greeting = name ? `${name},` : "";
  const titleLine = shootTitle
    ? `<p style="margin:0 0 16px;color:#666;font-size:14px">${shootTitle}</p>`
    : "";
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111">
    <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#999;margin:0 0 24px">Rintakez</p>
    <p style="margin:0 0 8px;font-size:15px">${greeting}</p>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;letter-spacing:-.01em">${c.lead}</h1>
    ${titleLine}
    <a href="${url}" style="display:inline-block;margin-top:16px;background:#111;color:#fff;text-decoration:none;padding:12px 22px;font-size:14px">${c.cta}</a>
  </div>`;
  return { subject: c.subject, html };
}

/**
 * Drain pending outbox rows: render + send each, marking sent/failed and
 * tracking attempts. Safe to call repeatedly (idempotent per row via status).
 * Returns a small summary for the cron route. No-op without RESEND_API_KEY.
 */
export async function drainEmailOutbox(
  limit = 25
): Promise<{ processed: number; sent: number; failed: number; skipped: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { processed: 0, sent: 0, failed: 0, skipped: true };
  if (!RESEND_API_KEY) return { processed: 0, sent: 0, failed: 0, skipped: true };

  const { data: rows } = await admin
    .from("email_outbox")
    .select("id, recipient_id, kind, shoot_id, shoot_title, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!rows || rows.length === 0)
    return { processed: 0, sent: 0, failed: 0, skipped: false };

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const { data: userRes } = await admin.auth.admin.getUserById(
        row.recipient_id
      );
      const email = userRes?.user?.email;
      if (!email) throw new Error("recipient has no email");

      const { data: profile } = await admin
        .from("profiles")
        .select("display_name, locale")
        .eq("id", row.recipient_id)
        .single();

      const locale = (profile?.locale ?? "de") as Locale;
      const kind = row.kind as EmailKind;
      const { subject, html } = render(
        kind,
        locale,
        profile?.display_name ?? "",
        row.shoot_title,
        link(kind, locale, row.shoot_id)
      );

      await sendEmail(email, subject, html);

      await admin
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      await admin
        .from("email_outbox")
        .update({
          // Give up after MAX_ATTEMPTS so a poison row doesn't loop forever.
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          attempts,
          last_error: message.slice(0, 500),
        })
        .eq("id", row.id);
      captureError(err, { scope: "email.drain", id: String(row.id) });
      failed++;
    }
  }

  return { processed: rows.length, sent, failed, skipped: false };
}
