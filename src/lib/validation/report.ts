export const REPORT_CATEGORIES = [
  "spam",
  "harassment",
  "scam",
  "inappropriate_content",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
