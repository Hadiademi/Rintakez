import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EditShootForm } from "@/components/edit-shoot-form";

export const dynamic = "force-dynamic";

export default async function EditShootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }

  const supabase = await createClient();
  const { data: shoot } = await supabase
    .from("shoots")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Only the owner may edit, and only while the shoot is still open.
  if (!shoot || shoot.client_id !== profile.id || shoot.status !== "open") {
    redirect({ href: `/shoots/${id}`, locale });
    return null;
  }

  const t = await getTranslations("createShoot");

  const initial = {
    title: shoot.title,
    type: shoot.type,
    discipline: shoot.discipline,
    brief: shoot.brief,
    locationCity: shoot.location_city,
    locationPostcode: shoot.location_postcode ?? "",
    canton: shoot.canton,
    shootDate: shoot.shoot_date,
    durationHours: shoot.duration_hours,
    budgetMinChf: shoot.budget_min_chf,
    budgetMaxChf: shoot.budget_max_chf,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">
        {t("editTitle")}
      </h1>
      <EditShootForm shootId={id} initial={initial} />
    </div>
  );
}
