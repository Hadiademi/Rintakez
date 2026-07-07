// Pure date arithmetic for admin comp grants. ZERO framework imports, mirrors
// zurich.ts's convention of staying dependency-free so it can be shared by
// web and (later) a native client.

/**
 * Add whole months in UTC, clamping to the last day of the target month
 * (e.g. Jan 31 + 1 month → Feb 28, or Feb 29 in a leap year). Preserves the
 * time-of-day components.
 */
export function addMonthsUtc(date: Date, months: number): Date {
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;

  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}
