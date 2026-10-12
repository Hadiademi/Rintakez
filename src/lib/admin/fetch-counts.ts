import "server-only";
import { adminPageClient } from "@/lib/admin/guard";
import { toAdminCounts, type AdminCounts } from "@/lib/admin/counts";

/** Open work per moderation/system area, for the sidebar urgency dots. */
export async function fetchAdminCounts(): Promise<AdminCounts> {
  const admin = await adminPageClient();
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
