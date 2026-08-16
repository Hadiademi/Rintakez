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
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Framly <onboarding@resend.dev>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const MAX_ATTEMPTS = 5;
const SEND_TIMEOUT_MS = 8000;

export type EmailKind =
  | "bid_received"
  | "bid_accepted"
  | "bid_declined"
  | "shoot_cancelled"
  | "message_received"
  | "shoot_invitation"
  | "shoot_match"
  | "welcome"
  | "onboarding_reminder"
  | "zero_bid_rescue"
  | "review_request"
  | "shoot_match_digest"
  | "admin_alert";
type Locale = "de" | "fr" | "en";

// Which notification-preference column gates each email kind (missing = always
// send). Partial: the lifecycle kinds (welcome/onboarding_reminder/
// zero_bid_rescue/review_request/shoot_match_digest) are enqueued directly
// into email_outbox by a DB trigger or the cron scans in lifecycle.ts, never
// via notifyEmail, so they have no entry here — the `if (prefColumn)` guard
// below treats that as "always send" (harmless; notifyEmail simply isn't the
// enqueue path for them). shoot_match_digest specifically: scanShootMatchDigest
// already excludes photographers via filterByNotifyShootUpdates before
// enqueuing, so the preference is honored at the scan, not here.
const PREF_COLUMN: Partial<
  Record<EmailKind, "notify_bids" | "notify_shoot_updates" | "notify_messages">
> = {
  bid_received: "notify_bids",
  bid_accepted: "notify_bids",
  bid_declined: "notify_bids",
  shoot_cancelled: "notify_shoot_updates",
  message_received: "notify_messages",
  shoot_invitation: "notify_shoot_updates",
  shoot_match: "notify_shoot_updates",
};

/**
 * Enqueue the email mirror of an in-app notification. Fast, non-blocking, and a
 * no-op when the service role is not configured. Respects the recipient's
 * notification preferences. Never throws into the caller.
 *
 * `dedupeWindowMs`, when set, collapses a burst of the same notification into
 * ~one email per window: before inserting, we check email_outbox for an
 * existing row with the same recipient_id + kind + shoot_id created within
 * the window, and skip the insert if one is found. This is what keeps a busy
 * back-and-forth message thread from sending one email per message (and
 * training the recipient to mark the sender as spam). Callers that omit
 * dedupeWindowMs keep the old always-enqueue behaviour.
 */
export async function notifyEmail(opts: {
  kind: EmailKind;
  recipientId: string;
  shootId?: string | null;
  shootTitle?: string | null;
  dedupeWindowMs?: number;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    // Honour the recipient's preference for this category before enqueuing.
    const prefColumn = PREF_COLUMN[opts.kind];
    if (prefColumn) {
      const { data: pref } = await admin
        .from("profiles")
        .select(prefColumn)
        .eq("id", opts.recipientId)
        .maybeSingle();
      const enabled = (pref as Record<string, boolean> | null)?.[prefColumn];
      if (enabled === false) return;
    }

    if (opts.dedupeWindowMs) {
      const since = new Date(Date.now() - opts.dedupeWindowMs).toISOString();
      let dedupeQuery = admin
        .from("email_outbox")
        .select("id")
        .eq("recipient_id", opts.recipientId)
        .eq("kind", opts.kind)
        .gte("created_at", since);
      // `.eq` can't match NULL in SQL semantics, so branch on whether this
      // kind carries a shoot_id (message_received always does — a
      // conversation is 1:1 with its shoot).
      dedupeQuery = opts.shootId
        ? dedupeQuery.eq("shoot_id", opts.shootId)
        : dedupeQuery.is("shoot_id", null);
      const { data: recent } = await dedupeQuery.limit(1).maybeSingle();
      if (recent) return;
    }

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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      // The plain-text alternative improves spam scoring and covers clients
      // that refuse HTML.
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html, text }),
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
  let path: string;
  if (kind === "welcome") {
    path = `/${locale}/home`;
  } else if (kind === "onboarding_reminder") {
    path = `/${locale}/onboarding`;
  } else if (kind === "message_received") {
    path = `/${locale}/messages`;
  } else if (kind === "admin_alert") {
    path = `/${locale}/admin`;
  } else if (kind === "shoot_match_digest") {
    path = `/${locale}/shoots`;
  } else if (
    (kind === "bid_received" ||
      kind === "shoot_cancelled" ||
      kind === "shoot_invitation" ||
      kind === "shoot_match" ||
      kind === "zero_bid_rescue" ||
      kind === "review_request") &&
    shootId
  ) {
    path = `/${locale}/shoots/${shootId}`;
  } else {
    path = `/${locale}/my-bids`;
  }
  return `${SITE_URL}${path}`;
}

// Exported for unit tests and the email-preview tooling.
export const COPY: Record<
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
  message_received: {
    de: { subject: "Neue Nachricht auf Framly", lead: "Du hast eine neue Nachricht erhalten", cta: "Nachricht öffnen" },
    fr: { subject: "Nouveau message sur Framly", lead: "Tu as reçu un nouveau message", cta: "Ouvrir le message" },
    en: { subject: "New message on Framly", lead: "You received a new message", cta: "Open message" },
  },
  shoot_invitation: {
    de: { subject: "Ein Kunde hat dich zu seinem Shooting eingeladen", lead: "Du wurdest eingeladen, ein Angebot abzugeben", cta: "Shooting ansehen" },
    fr: { subject: "Un client t’a invité à sa séance", lead: "Tu as été invité à faire une offre", cta: "Voir la séance" },
    en: { subject: "A client invited you to their shoot", lead: "You've been invited to bid on a shoot", cta: "View shoot" },
  },
  shoot_match: {
    de: { subject: "Neues Shooting in deiner Region", lead: "Ein neues Shooting passt zu deinem Profil", cta: "Shooting ansehen" },
    fr: { subject: "Nouvelle séance dans ta région", lead: "Une nouvelle séance correspond à ton profil", cta: "Voir la séance" },
    en: { subject: "New shoot in your area", lead: "A new shoot matches your coverage", cta: "View shoot" },
  },
  welcome: {
    de: { subject: "Willkommen bei Framly", lead: "Willkommen bei Framly — schön, dass du da bist", cta: "Los geht’s" },
    fr: { subject: "Bienvenue sur Framly", lead: "Bienvenue sur Framly — ravis de t’avoir avec nous", cta: "C’est parti" },
    en: { subject: "Welcome to Framly", lead: "Welcome to Framly — glad to have you here", cta: "Get started" },
  },
  onboarding_reminder: {
    de: { subject: "Vervollständige dein Fotografen-Profil", lead: "Dein Profil ist fast fertig — ergänze deine Angaben, um Aufträge zu erhalten", cta: "Profil vervollständigen" },
    fr: { subject: "Complète ton profil de photographe", lead: "Ton profil est presque prêt — complète tes informations pour recevoir des mandats", cta: "Compléter mon profil" },
    en: { subject: "Complete your photographer profile", lead: "Your profile is almost ready — finish it to start receiving shoots", cta: "Complete profile" },
  },
  zero_bid_rescue: {
    de: { subject: "Noch keine Angebote für dein Shooting", lead: "Dein Shooting hat noch keine Angebote erhalten", cta: "Shooting ansehen" },
    fr: { subject: "Pas encore d’offre pour ta séance", lead: "Ta séance n’a pas encore reçu d’offre", cta: "Voir la séance" },
    en: { subject: "No offers yet for your shoot", lead: "Your shoot hasn't received any offers yet", cta: "View shoot" },
  },
  review_request: {
    de: { subject: "Wie war dein Shooting?", lead: "Dein Shooting ist abgeschlossen — hinterlasse jetzt eine Bewertung", cta: "Bewertung abgeben" },
    fr: { subject: "Comment s’est passée ta séance ?", lead: "Ta séance est terminée — laisse une évaluation dès maintenant", cta: "Laisser une évaluation" },
    en: { subject: "How was your shoot?", lead: "Your shoot is complete — leave a review now", cta: "Leave a review" },
  },
  admin_alert: {
    de: { subject: "Neuer Vorgang zur Prüfung", lead: "Ein neuer Vorgang muss moderiert werden", cta: "Admin öffnen" },
    fr: { subject: "Nouveau signalement à examiner", lead: "Un nouvel élément nécessite une modération", cta: "Ouvrir l’admin" },
    en: { subject: "New report/dispute to review", lead: "A new item needs moderation", cta: "Open admin" },
  },
  shoot_match_digest: {
    de: { subject: "Neue Shootings passen zu deinem Profil", lead: "Heute haben neue Shootings zu deinem Profil gepasst", cta: "Shootings ansehen" },
    fr: { subject: "De nouvelles séances correspondent à ton profil", lead: "Aujourd’hui, de nouvelles séances ont correspondu à ton profil", cta: "Voir les séances" },
    en: { subject: "New shoots match your profile", lead: "New shoots matched your profile today", cta: "View shoots" },
  },
};

// Footer link to the notification-preferences section of the profile page.
// Shown on every email so a recipient annoyed by volume can turn a category
// off instead of hitting "mark as spam" (which hurts sender reputation for
// everyone). Kept short and muted so it doesn't compete with the main CTA.
const FOOTER: Record<Locale, string> = {
  de: "Benachrichtigungen verwalten",
  fr: "Gérer tes préférences de notifications",
  en: "Manage your notification preferences",
};

const TAGLINE: Record<Locale, string> = {
  de: "Foto & Video in der Schweiz",
  fr: "Photo & vidéo en Suisse",
  en: "Photo & video in Switzerland",
};

const IMPRESSUM: Record<Locale, string> = {
  de: "Impressum",
  fr: "Mentions légales",
  en: "Legal notice",
};

// Brand terracotta (the wordmark's period) — mirrors --accent-rgb in
// globals.css light theme.
const ACCENT = "#C8462C";

/**
 * Branded transactional template. Email-client constraints shape everything
 * here: table layout + inline styles (Outlook ignores <style>), the wordmark
 * as styled TEXT (remote images are blocked by default in Gmail/Outlook — a
 * text wordmark always renders), and a hidden preheader span so inbox list
 * views show the lead instead of random body text.
 */
export function renderBrandedEmail(opts: {
  locale: Locale;
  lead: string;
  cta: string;
  url: string;
  greeting?: string;
  detail?: string | null;
  /** Extra body paragraph between the lead and the CTA (already localized). */
  body?: string | null;
  /** Overrides the footer's manage-notifications link (e.g. auth emails). */
  footerLink?: { href: string; label: string } | null;
}): string {
  const {
    locale,
    lead,
    cta,
    url,
    greeting = "",
    detail = null,
    body = null,
  } = opts;
  const footerLink =
    opts.footerLink === undefined
      ? {
          href: `${SITE_URL}/${locale}/profile#notifications`,
          label: FOOTER[locale],
        }
      : opts.footerLink;

  return `<!DOCTYPE html>
<html lang="${locale}">
<body style="margin:0;padding:0;background:#f4f2ee">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${lead}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px">
        <tr><td style="padding:0 4px 18px">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;letter-spacing:-.02em;color:#141414">Framly<span style="color:${ACCENT}">.</span></span>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e6e2da;padding:36px 32px">
          ${greeting ? `<p style="font-family:Inter,Helvetica,Arial,sans-serif;margin:0 0 10px;font-size:15px;color:#141414">${greeting}</p>` : ""}
          <h1 style="font-family:Inter,Helvetica,Arial,sans-serif;margin:0 0 10px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.01em;color:#141414">${lead}</h1>
          ${detail ? `<p style="font-family:Inter,Helvetica,Arial,sans-serif;margin:0 0 6px;font-size:14px;color:#6b6b6b">${detail}</p>` : ""}
          ${body ? `<p style="font-family:Inter,Helvetica,Arial,sans-serif;margin:14px 0 0;font-size:15px;line-height:1.6;color:#3d3d3d">${body}</p>` : ""}
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0">
            <tr><td style="background:#141414">
              <a href="${url}" style="font-family:Inter,Helvetica,Arial,sans-serif;display:inline-block;padding:13px 26px;font-size:14px;font-weight:500;color:#ffffff;text-decoration:none">${cta}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 4px 0">
          <p style="font-family:Inter,Helvetica,Arial,sans-serif;margin:0;font-size:12px;line-height:1.7;color:#9a958c">
            <span style="color:#6b6b6b">Framly</span> — ${TAGLINE[locale]}<br>
            <a href="${SITE_URL}/${locale}" style="color:#9a958c;text-decoration:underline">framly.ch</a>
            &nbsp;·&nbsp;
            <a href="${SITE_URL}/${locale}/impressum" style="color:#9a958c;text-decoration:underline">${IMPRESSUM[locale]}</a>${
              footerLink
                ? `
            &nbsp;·&nbsp;
            <a href="${footerLink.href}" style="color:#9a958c;text-decoration:underline">${footerLink.label}</a>`
                : ""
            }
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function render(
  kind: EmailKind,
  locale: Locale,
  name: string,
  shootTitle: string | null,
  url: string
): { subject: string; html: string; text: string } {
  const c = COPY[kind][locale];
  const greeting = name ? `${name},` : "";
  const html = renderBrandedEmail({
    locale,
    lead: c.lead,
    cta: c.cta,
    url,
    greeting,
    detail: shootTitle,
  });
  const text = [
    greeting,
    c.lead,
    shootTitle ?? "",
    "",
    `${c.cta}: ${url}`,
    "",
    `Framly — ${TAGLINE[locale]}`,
    `${FOOTER[locale]}: ${SITE_URL}/${locale}/profile#notifications`,
  ]
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n");
  return { subject: c.subject, html, text };
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
      const { subject, html, text } = render(
        kind,
        locale,
        profile?.display_name ?? "",
        row.shoot_title,
        link(kind, locale, row.shoot_id)
      );

      await sendEmail(email, subject, html, text);

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
