import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminVerifyRow } from "@/components/admin-verify-row";

export const dynamic = "force-dynamic";

export default async function AdminVerificationsPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  const { data: pending } = await admin
    .from("photographer_details")
    .select("profile_id")
    .eq("verification_status", "pending")
    .limit(100);

  const ids = (pending ?? []).map((d) => d.profile_id);
  const { data: profiles } = ids.length
    ? await admin
        .from("profiles")
        .select("id, display_name, city")
        .in("id", ids)
    : { data: [] as { id: string; display_name: string; city: string | null }[] };

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {t("verifications")}
      </h2>
      {(profiles ?? []).length === 0 ? (
        <p className="text-mute">{t("noVerifications")}</p>
      ) : (
        <div className="space-y-3">
          {(profiles ?? []).map((p) => (
            <AdminVerifyRow key={p.id} id={p.id} name={p.display_name} city={p.city} />
          ))}
        </div>
      )}
    </section>
  );
}
