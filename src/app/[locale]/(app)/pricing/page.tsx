import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/billing/entitlements";
import { hasYearlyPrices } from "@/lib/billing/plans";
import { PricingCards, type PricingViewer } from "@/components/pricing-cards";
import { PricingFaq } from "@/components/pricing-faq";
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

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-2xl text-center">
        <p className="label text-mute">{t("pricing.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
          {t("pricing.heading")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-mute sm:text-lg">
          {t("pricing.subheading")}
        </p>
      </div>

      <div className="mt-12">
        <PricingCards viewer={viewer} yearlyAvailable={yearlyAvailable} />
      </div>

      <p className="label mt-10 text-center text-mute-2">{t("pricing.footerLine")}</p>

      <div className="mx-auto mt-20 max-w-3xl">
        <PricingFaq />
      </div>
    </div>
  );
}
