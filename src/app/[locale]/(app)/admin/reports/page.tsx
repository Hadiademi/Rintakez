import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminReportRow } from "@/components/admin-report-row";

export const dynamic = "force-dynamic";

const STATUSES = ["open", "reviewed", "dismissed"] as const;
type Status = (typeof STATUSES)[number];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status: Status = (STATUSES as readonly string[]).includes(
    statusParam ?? ""
  )
    ? (statusParam as Status)
    : "open";

  const t = await getTranslations("admin");
  const tReport = await getTranslations("report");
  const admin = createAdminClient();
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  const { data: reports } = await admin
    .from("reports")
    .select("id, reporter_id, target_type, target_id, reason, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  const list = reports ?? [];
  const reporterIds = [...new Set(list.map((r) => r.reporter_id))];
  const profileTargetIds = list
    .filter((r) => r.target_type === "profile")
    .map((r) => r.target_id);
  const shootTargetIds = list
    .filter((r) => r.target_type === "shoot")
    .map((r) => r.target_id);

  const [{ data: reporters }, { data: targetProfiles }, { data: targetShoots }] =
    await Promise.all([
      reporterIds.length
        ? admin.from("profiles").select("id, display_name").in("id", reporterIds)
        : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
      profileTargetIds.length
        ? admin
            .from("profiles")
            .select("id, display_name, is_suspended")
            .in("id", profileTargetIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              display_name: string;
              is_suspended: boolean;
            }[],
          }),
      shootTargetIds.length
        ? admin
            .from("shoots")
            .select("id, title, is_suspended")
            .in("id", shootTargetIds)
        : Promise.resolve({
            data: [] as { id: string; title: string; is_suspended: boolean }[],
          }),
    ]);

  const reporterBy = new Map((reporters ?? []).map((p) => [p.id, p.display_name]));
  const targetProfileBy = new Map((targetProfiles ?? []).map((p) => [p.id, p]));
  const targetShootBy = new Map((targetShoots ?? []).map((s) => [s.id, s]));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {t("reports")}
        </h2>
        <nav className="flex gap-3 text-sm">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/reports?status=${s}`}
              aria-current={s === status ? "page" : undefined}
              className={
                s === status ? "font-medium text-ink" : "text-mute hover:text-ink"
              }
            >
              {t(`reportStatus.${s}`)}
            </Link>
          ))}
        </nav>
      </div>

      {list.length === 0 ? (
        <p className="text-mute">{t("noReports")}</p>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const isProfile = r.target_type === "profile";
            const targetProfile = targetProfileBy.get(r.target_id);
            const targetShoot = targetShootBy.get(r.target_id);
            const targetLabel = isProfile
              ? (targetProfile?.display_name ?? r.target_id)
              : (targetShoot?.title ?? r.target_id);
            const targetSuspended = isProfile
              ? (targetProfile?.is_suspended ?? false)
              : (targetShoot?.is_suspended ?? false);
            const targetHref = isProfile
              ? `/photographers/${r.target_id}`
              : `/shoots/${r.target_id}`;
            return (
              <AdminReportRow
                key={r.id}
                id={r.id}
                reporterName={reporterBy.get(r.reporter_id) ?? r.reporter_id}
                targetTypeLabel={tReport("report")}
                targetKind={r.target_type}
                targetId={r.target_id}
                targetSuspended={targetSuspended}
                targetLabel={targetLabel}
                targetHref={targetHref}
                reason={r.reason}
                createdAt={r.created_at}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
