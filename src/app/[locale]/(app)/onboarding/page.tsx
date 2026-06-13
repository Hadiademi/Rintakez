import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  // Load existing details — when present the page acts as an edit form rather
  // than first-time onboarding.
  const { data: details } = await supabase
    .from("photographer_details")
    .select(
      "specialties, coverage_cantons, hourly_rate_chf, website_url, instagram_url"
    )
    .eq("profile_id", profile.id)
    .maybeSingle();

  const { data: rawImages } = await supabase
    .from("portfolio_images")
    .select("id, storage_path")
    .eq("photographer_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const portfolio = (rawImages ?? []).map((img) => ({
    id: img.id,
    url: supabase.storage.from("portfolio").getPublicUrl(img.storage_path).data
      .publicUrl,
  }));

  const isEdit = !!details;
  const t = await getTranslations("onboarding");

  const initial = {
    specialties: details?.specialties ?? [],
    cantons: details?.coverage_cantons ?? [],
    hourlyRate:
      details?.hourly_rate_chf != null ? String(details.hourly_rate_chf) : "",
    website: details?.website_url ?? "",
    instagram: details?.instagram_url ?? "",
    portfolio,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium tracking-tight">
          {isEdit ? t("editTitle") : t("title")}
        </h1>
        <p className="mt-2 text-mute">
          {isEdit ? t("editSubtitle") : t("subtitle")}
        </p>
      </div>
      <OnboardingForm initial={initial} isEdit={isEdit} />
    </div>
  );
}
