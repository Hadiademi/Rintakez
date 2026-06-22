import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminEmailRetry } from "@/components/admin-email-retry";

export const dynamic = "force-dynamic";

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border border-line p-5">
      <div className="tabular text-3xl font-semibold text-ink">{value}</div>
      <div className="label mt-1 text-mute">{label}</div>
    </div>
  );
}

export default async function AdminEmailPage() {
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  if (!admin) return <p className="text-mute">Service role key not configured.</p>;

  const head = { count: "exact" as const, head: true };
  const [pending, sent, failed, { data: recent }] = await Promise.all([
    admin.from("email_outbox").select("id", head).eq("status", "pending"),
    admin.from("email_outbox").select("id", head).eq("status", "sent"),
    admin.from("email_outbox").select("id", head).eq("status", "failed"),
    admin
      .from("email_outbox")
      .select("id, kind, status, attempts, last_error, created_at")
      .in("status", ["failed", "pending"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const list = recent ?? [];

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {t("emailHealth")}
      </h2>

      <div className="grid grid-cols-3 gap-3">
        <Metric value={pending.count ?? 0} label={t("emailPending")} />
        <Metric value={sent.count ?? 0} label={t("emailSent")} />
        <Metric value={failed.count ?? 0} label={t("emailFailed")} />
      </div>

      {list.length === 0 ? (
        <p className="text-mute">{t("emailQueueEmpty")}</p>
      ) : (
        <div className="divide-y divide-line border border-line">
          {list.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
            >
              <span className="tabular shrink-0 text-mute-2">
                {r.created_at.slice(0, 16).replace("T", " ")}
              </span>
              <span className="font-medium text-ink">{r.kind}</span>
              <span
                className={`label rounded px-1.5 py-0.5 ${
                  r.status === "failed"
                    ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200"
                    : "bg-chip text-mute"
                }`}
              >
                {r.status}
              </span>
              <span className="text-mute-2">
                {t("emailAttempts", { n: r.attempts })}
              </span>
              {r.last_error ? (
                <span className="w-full truncate text-[13px] text-mute">
                  {r.last_error}
                </span>
              ) : null}
              {r.status === "failed" ? (
                <span className="ml-auto">
                  <AdminEmailRetry id={r.id} />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
