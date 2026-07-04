/**
 * Pure month-grid builder for the read-only availability calendar.
 * No React, no DOM, no timezone surprises: dates are built from local
 * calendar components and serialised as `yyyy-mm-dd`.
 */

export interface DayCell {
  /** ISO date `yyyy-mm-dd`. */
  dateISO: string;
  /** Whether the day belongs to the requested month (vs. a spill-over cell). */
  inMonth: boolean;
  /** In-month day present in the unavailable set. */
  isUnavailable: boolean;
  /** In-month day matching `todayISO`. */
  isToday: boolean;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Build a Monday-start month matrix.
 *
 * @param year   full year, e.g. 2026
 * @param month  0-indexed month (0 = January … 11 = December), matching JS Date
 * @param unavailable  set of unavailable ISO dates (`yyyy-mm-dd`)
 * @param todayISO     today's ISO date, used to flag the current day
 * @returns weeks (rows) of exactly 7 {@link DayCell}s, Monday → Sunday
 */
export function buildMonthMatrix(
  year: number,
  month: number,
  unavailable: Set<string>,
  todayISO: string
): DayCell[][] {
  const firstOfMonth = new Date(year, month, 1);
  // JS getDay: 0 = Sunday … 6 = Saturday. Shift so Monday = 0, Sunday = 6.
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = mondayOffset + daysInMonth;
  const weekCount = Math.ceil(totalCells / 7);

  const weeks: DayCell[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d - mondayOffset;
      const date = new Date(year, month, 1 + offset);
      const inMonth = date.getMonth() === month && date.getFullYear() === year;
      const dateISO = toISO(date);
      week.push({
        dateISO,
        inMonth,
        isUnavailable: inMonth && unavailable.has(dateISO),
        isToday: inMonth && dateISO === todayISO,
      });
    }
    weeks.push(week);
  }
  return weeks;
}
