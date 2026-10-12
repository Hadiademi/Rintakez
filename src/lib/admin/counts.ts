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
