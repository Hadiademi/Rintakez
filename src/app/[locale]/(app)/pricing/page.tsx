import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/billing/entitlements";
import { hasYearlyPrices } from "@/lib/billing/plans";
import { PricingCards, type PricingViewer } from "@/components/pricing-cards";
import { buildAlternates } from "@/lib/seo";

// Viewer-dependent CTA (anon/client/photographer, current plan, comp expiry)
// — never statically cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    // pricingTitle is a full standalone title (already includes "— Rintakez",
    // per the brief's verbatim copy) — bypass the root layout's "%s — Rintakez"
    // template the same way the homepage does, or the suffix would double up.
    title: { absolute: t("pricingTitle") },
    description: t("pricingDescription"),
    alternates: buildAlternates(locale, "/pricing"),
  };
}

async function resolveViewer(): Promise<PricingViewer> {
  const profile = await getProfile();
  if (!profile) return { kind: "anon" };
  if (profile.role !== "photographer") return { kind: "client" };

  const supabase = await createClient();
  const entitlement = await getEntitlement(supabase, profile.id);

  if (!entitlement.isActive) return { kind: "photographerFree" };

  return {
    kind: entitlement.source === "admin_comp" ? "photographerComp" : "photographerEntitled",
    currentPlan: entitlement.plan,
    expiresAt: entitlement.expiresAt,
  };
}

export default async function PricingPage() {
  const [viewer, t] = await Promise.all([
    resolveViewer(),
    getTranslations("billing"),
  ]);
  const yearlyAvailable = hasYearlyPrices();

  const trustPoints = [
    t("pricing.trustNoCommission"),
    t("pricing.trustCancel"),
    t("pricing.trialNote"),
  ];

  return (
    <div className="relative mx-auto max-w-6xl">
      {/* Ambient light — the photography motif: a soft warm wash behind the
          hero, echoing light entering a lens. Purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-4rem] -z-10 h-72 w-[42rem] max-w-full -translate-x-1/2 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.14), transparent)",
        }}
      />

      <div className="mx-auto max-w-2xl text-center">
        <p className="label text-accent">{t("pricing.eyebrow")}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {t("pricing.heading")}
        </h1>
        <p className="mt-3 text-base text-mute">{t("pricing.subheading")}</p>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {trustPoints.map((point) => (
            <li
              key={point}
              className="flex items-center gap-1.5 text-[13px] text-ink"
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
              />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12">
        <PricingCards viewer={viewer} yearlyAvailable={yearlyAvailable} />
      </div>

      <div className="mt-14 border-t border-line pt-6">
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[13px] text-mute">
          <span>{t("pricing.foundingNote")}</span>
          {!yearlyAvailable ? (
            <>
              <span aria-hidden="true" className="text-line-strong">·</span>
              <span>{t("pricing.yearlyTeaser")}</span>
            </>
          ) : null}
        </p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[13px] text-mute-2">
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 1.5l5 2v4c0 3.2-2.1 5.6-5 7-2.9-1.4-5-3.8-5-7v-4l5-2z" />
          </svg>
          {t("pricing.securedByStripe")}
        </p>
      </div>
    </div>
  );
}
