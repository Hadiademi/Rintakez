import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-line p-5">
      <div className="tabular text-3xl font-semibold text-ink">{value}</div>
      <div className="label mt-1 text-mute">{label}</div>
    </div>
  );
}

function Attention({
  value,
  label,
  href,
}: {
  value: number;
  label: string;
  href: string;
}) {
  const urgent = value > 0;
  return (
    <Link
      href={href}
      className={`press flex items-center justify-between border p-4 transition-colors ${
        urgent
          ? "border-accent/40 bg-accent/5 hover:border-accent"
          : "border-line hover:border-mute-2"
      }`}
    >
      <span className="text-sm text-ink">{label}</span>
      <span
        className={`tabular text-xl font-semibold ${urgent ? "text-accent" : "text-mute"}`}
      >
        {value}
      </span>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  if (!admin) {
    return <p className="text-mute">Service role key not configured.</p>;
  }

  const head = { count: "exact" as const, head: true };
  const now = new Date().getTime();
  const days = (n: number) => new Date(now - n * 86_400_000).toISOString();

  const [
    users,
    photographers,
    shoots,
    openShoots,
    openReports,
    pendingVerifications,
    suspendedUsers,
    failedEmails,
    openDisputes,
    signups7,
    signups30,
  ] = await Promise.all([
    admin.from("profiles").select("id", head),
    admin.from("profiles").select("id", head).eq("role", "photographer"),
    admin.from("shoots").select("id", head),
    admin.from("shoots").select("id", head).eq("status", "open"),
    admin.from("reports").select("id", head).eq("status", "open"),
    admin
      .from("photographer_details")
      .select("profile_id", head)
      .eq("verification_status", "pending"),
    admin.from("profiles").select("id", head).eq("is_suspended", true),
    admin.from("email_outbox").select("id", head).eq("status", "failed"),
    admin.from("disputes").select("id", head).eq("status", "open"),
    admin.from("profiles").select("id", head).gte("created_at", days(7)),
    admin.from("profiles").select("id", head).gte("created_at", days(30)),
  ]);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric value={users.count ?? 0} label={t("metricUsers")} />
        <Metric
          value={photographers.count ?? 0}
          label={t("metricPhotographers")}
        />
        <Metric value={shoots.count ?? 0} label={t("metricShoots")} />
        <Metric value={openShoots.count ?? 0} label={t("metricOpenShoots")} />
        <Metric value={signups7.count ?? 0} label={t("metricSignups7")} />
        <Metric value={signups30.count ?? 0} label={t("metricSignups30")} />
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {t("needsAttention")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Attention
            value={openReports.count ?? 0}
            label={t("metricReports")}
            href="/admin/reports"
          />
          <Attention
            value={pendingVerifications.count ?? 0}
            label={t("tabVerifications")}
            href="/admin/verifications"
          />
          <Attention
            value={suspendedUsers.count ?? 0}
            label={t("suspendedUsers")}
            href="/admin/users?status=suspended"
          />
          <Attention
            value={failedEmails.count ?? 0}
            label={t("failedEmails")}
            href="/admin/email"
          />
          <Attention
            value={openDisputes.count ?? 0}
            label={t("disputes")}
            href="/admin/disputes"
          />
        </div>
      </section>
    </div>
  );
}
