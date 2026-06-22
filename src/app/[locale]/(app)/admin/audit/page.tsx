import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function metaSummary(meta: unknown): string {
  if (!meta || typeof meta !== "object") return "";
  const m = meta as Record<string, unknown>;
  const v = m.reason ?? m.note;
  return typeof v === "string" ? v : "";
}

export default async function AdminAuditPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  const { data: rows } = await admin
    .from("audit_log")
    .select("id, actor_id, action, target_type, target_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const list = rows ?? [];
  const actorIds = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const actorBy = new Map((actors ?? []).map((a) => [a.id, a.display_name]));

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {t("auditLog")}
      </h2>
      {list.length === 0 ? (
        <p className="text-mute">{t("noAudit")}</p>
      ) : (
        <div className="divide-y divide-line border border-line">
          {list.map((r) => {
            const note = metaSummary(r.meta);
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="tabular shrink-0 text-mute-2">
                  {r.created_at.slice(0, 16).replace("T", " ")}
                </span>
                <span className="font-medium text-ink">{r.action}</span>
                <span className="text-mute">
                  {r.target_type}
                  {r.target_id ? ` · ${r.target_id.slice(0, 8)}` : ""}
                </span>
                <span className="text-mute-2">
                  {t("auditBy")}{" "}
                  {r.actor_id ? (actorBy.get(r.actor_id) ?? r.actor_id.slice(0, 8)) : "—"}
                </span>
                {note ? (
                  <span className="w-full text-[13px] text-mute">“{note}”</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
