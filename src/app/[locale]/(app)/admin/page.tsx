import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminReportRow } from "@/components/admin-report-row";

export const dynamic = "force-dynamic";

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-line p-5">
      <div className="tabular text-3xl font-semibold text-ink">{value}</div>
      <div className="label mt-1 text-mute">{label}</div>
    </div>
  );
}

export default async function AdminPage() {
  const [profile, locale] = await Promise.all([getProfile(), getLocale()]);
  if (!profile) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (!profile.is_admin) {
    redirect({ href: "/home", locale });
    return null;
  }

  const t = await getTranslations("admin");
  const tReport = await getTranslations("report");
  const admin = createAdminClient();
  if (!admin) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-mute">Service role key not configured.</p>
      </div>
    );
  }

  const head = { count: "exact" as const, head: true };
  const [
    users,
    photographers,
    shoots,
    openShoots,
    openReports,
    { data: reports },
  ] = await Promise.all([
    admin.from("profiles").select("id", head),
    admin
      .from("profiles")
      .select("id", head)
      .eq("role", "photographer"),
    admin.from("shoots").select("id", head),
    admin.from("shoots").select("id", head).eq("status", "open"),
    admin.from("reports").select("id", head).eq("status", "open"),
    admin
      .from("reports")
      .select("id, reporter_id, target_type, target_id, reason, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Resolve reporter names + target labels.
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

  const reporterBy = new Map(
    (reporters ?? []).map((p) => [p.id, p.display_name])
  );
  const targetProfileBy = new Map(
    (targetProfiles ?? []).map((p) => [p.id, p])
  );
  const targetShootBy = new Map((targetShoots ?? []).map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">
        {t("title")}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric value={users.count ?? 0} label={t("metricUsers")} />
        <Metric
          value={photographers.count ?? 0}
          label={t("metricPhotographers")}
        />
        <Metric value={shoots.count ?? 0} label={t("metricShoots")} />
        <Metric value={openShoots.count ?? 0} label={t("metricOpenShoots")} />
        <Metric value={openReports.count ?? 0} label={t("metricReports")} />
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {t("reports")}
        </h2>
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
    </div>
  );
}
