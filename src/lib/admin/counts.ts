import { createAdminClient } from "@/lib/supabase/admin";

export type AdminCounts = {
  reports: number;
  verifications: number;
  disputes: number;
  email: number;
};

type HeadResult = { count: number | null };

/**
 * Pure mapper over Supabase head-count results. Split from the query so the
 * null-to-zero rule is testable without a database.
 */
export function toAdminCounts(r: {
  reports: HeadResult;
  verifications: HeadResult;
  disputes: HeadResult;
  email: HeadResult;
}): AdminCounts {
  return {
    reports: r.reports.count ?? 0,
    verifications: r.verifications.count ?? 0,
    disputes: r.disputes.count ?? 0,
    email: r.email.count ?? 0,
  };
}

/** Open work per moderation/system area, for the sidebar urgency dots. */
export async function fetchAdminCounts(): Promise<AdminCounts> {
  const admin = createAdminClient();
  if (!admin) return { reports: 0, verifications: 0, disputes: 0, email: 0 };

  const head = { count: "exact" as const, head: true };
  const [reports, verifications, disputes, email] = await Promise.all([
    admin.from("reports").select("id", head).eq("status", "open"),
    admin
      .from("photographer_details")
      .select("profile_id", head)
      .eq("verification_status", "pending"),
    admin.from("disputes").select("id", head).eq("status", "open"),
    admin.from("email_outbox").select("id", head).eq("status", "failed"),
  ]);

  return toAdminCounts({ reports, verifications, disputes, email });
}
