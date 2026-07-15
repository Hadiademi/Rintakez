import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminDisputeRow } from "@/components/admin-dispute-row";

export const dynamic = "force-dynamic";

export default async function AdminDisputesPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  const { data: disputes } = await admin
    .from("disputes")
    .select("id, shoot_id, opened_by, reason, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = disputes ?? [];
  const shootIds = [...new Set(list.map((d) => d.shoot_id))];
  const openerIds = [...new Set(list.map((d) => d.opened_by))];

  const [{ data: shoots }, { data: openers }] = await Promise.all([
    shootIds.length
      ? admin.from("shoots").select("id, title").in("id", shootIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    openerIds.length
      ? admin.from("profiles").select("id, display_name").in("id", openerIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);

  const titleBy = new Map((shoots ?? []).map((s) => [s.id, s.title]));
  const nameBy = new Map((openers ?? []).map((p) => [p.id, p.display_name]));

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {t("disputes")}
      </h2>
      {list.length === 0 ? (
        <p className="text-mute">{t("noDisputes")}</p>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <AdminDisputeRow
              key={d.id}
              id={d.id}
              shootId={d.shoot_id}
              shootTitle={titleBy.get(d.shoot_id) ?? d.shoot_id}
              openedByName={nameBy.get(d.opened_by) ?? d.opened_by}
              reason={d.reason}
              createdAt={d.created_at}
            />
          ))}
        </div>
      )}
    </section>
  );
}
