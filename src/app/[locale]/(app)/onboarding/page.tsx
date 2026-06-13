import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile, photographerNeedsOnboarding } from "@/lib/auth";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);

  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  if (profile.role !== "photographer") {
    redirect({ href: "/home", locale });
    return null;
  }

  const needsOnboarding = await photographerNeedsOnboarding();
  if (!needsOnboarding) {
    redirect({ href: "/home", locale });
    return null;
  }

  const t = await getTranslations("onboarding");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-mute">{t("subtitle")}</p>
      </div>
      <OnboardingForm />
    </div>
  );
}
