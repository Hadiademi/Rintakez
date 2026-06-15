import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/observability";

// Email is an optional, gated feature: with no RESEND_API_KEY the whole module
// is a no-op, so local/dev runs behave exactly as before. When the key is set
// (production), notifications are mirrored to email via the Resend REST API.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Rintakez <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type EmailKind = "bid_received" | "bid_accepted" | "bid_declined";
type Locale = "de" | "fr" | "en";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
  } catch (err) {
    // Email must never break the originating action, but the failure should be
    // visible in observability rather than silently swallowed.
    captureError(err, { scope: "email.send", subject });
  }
}

function link(kind: EmailKind, locale: Locale, shootId?: string | null): string {
  const path =
    kind === "bid_received" && shootId
      ? `/${locale}/shoots/${shootId}`
      : `/${locale}/my-bids`;
  return `${APP_URL}${path}`;
}

const COPY: Record<
  EmailKind,
  Record<Locale, { subject: string; lead: string; cta: string }>
> = {
  bid_received: {
    de: {
      subject: "Neues Angebot für dein Shooting",
      lead: "Du hast ein neues Angebot erhalten",
      cta: "Angebot ansehen",
    },
    fr: {
      subject: "Nouvelle offre pour ton shooting",
      lead: "Tu as reçu une nouvelle offre",
      cta: "Voir l’offre",
    },
    en: {
      subject: "New offer for your shoot",
      lead: "You received a new offer",
      cta: "View offer",
    },
  },
  bid_accepted: {
    de: {
      subject: "Dein Angebot wurde angenommen",
      lead: "Glückwunsch — dein Angebot wurde angenommen",
      cta: "Zu meinen Angeboten",
    },
    fr: {
      subject: "Ton offre a été acceptée",
      lead: "Félicitations — ton offre a été acceptée",
      cta: "Mes offres",
    },
    en: {
      subject: "Your offer was accepted",
      lead: "Congratulations — your offer was accepted",
      cta: "Go to my offers",
    },
  },
  bid_declined: {
    de: {
      subject: "Update zu deinem Angebot",
      lead: "Dein Angebot wurde leider abgelehnt",
      cta: "Zu meinen Angeboten",
    },
    fr: {
      subject: "Mise à jour de ton offre",
      lead: "Ton offre a malheureusement été refusée",
      cta: "Mes offres",
    },
    en: {
      subject: "Update on your offer",
      lead: "Your offer was unfortunately declined",
      cta: "Go to my offers",
    },
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
 * Send the email mirror of an in-app notification. Fully no-op without
 * RESEND_API_KEY (it returns before any admin lookup). Never throws.
 */
export async function notifyEmail(opts: {
  kind: EmailKind;
  recipientId: string;
  shootId?: string | null;
  shootTitle?: string | null;
}): Promise<void> {
  if (!RESEND_API_KEY) return;

  const admin = createAdminClient();
  if (!admin) return;

  try {
    const { data: userRes } = await admin.auth.admin.getUserById(
      opts.recipientId
    );
    const email = userRes?.user?.email;
    if (!email) return;

    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, locale")
      .eq("id", opts.recipientId)
      .single();

    const locale = (profile?.locale ?? "de") as Locale;
    const { subject, html } = render(
      opts.kind,
      locale,
      profile?.display_name ?? "",
      opts.shootTitle ?? null,
      link(opts.kind, locale, opts.shootId)
    );

    await sendEmail(email, subject, html);
  } catch (err) {
    // Best-effort — never throw into the caller, but surface to observability.
    captureError(err, { scope: "email.notify", kind: opts.kind });
  }
}
