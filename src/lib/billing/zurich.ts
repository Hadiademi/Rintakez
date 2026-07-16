// Pure Zurich-timezone helpers (uses Intl.DateTimeFormat, no dependency).
// Framly's monthly bid quota resets on the Zurich-local calendar month, and
// scheduled/notification jobs key off the Zurich-local hour/date — Switzerland
// observes CET/CEST DST, so naive UTC math would drift by an hour twice a year.

const ZURICH_TZ = "Europe/Zurich";

function formatParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZURICH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) map[part.type] = part.value;
  return map;
}

/**
 * The UTC-offset (in minutes, east-positive) Europe/Zurich observes at the
 * given instant. +60 in CET (winter), +120 in CEST (summer).
 */
function zurichOffsetMinutes(date: Date): number {
  const p = formatParts(date);
  // Some ICU implementations render midnight as hour "24" with hour12:false;
  // normalize back into 0-23.
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second)
  );
  return Math.round((asIfUtc - date.getTime()) / 60_000);
}

/** The UTC instant corresponding to Zurich-local 1st-of-month 00:00:00. */
export function monthStartZurich(now: Date): Date {
  const p = formatParts(now);
  const year = Number(p.year);
  const month = Number(p.month);
  // Zurich-local 1st-of-month 00:00, read AS IF it were already UTC.
  const guessAsUtc = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  // Correct by the actual Zurich UTC offset at that instant (DST-aware).
  const offsetMinutes = zurichOffsetMinutes(guessAsUtc);
  return new Date(guessAsUtc.getTime() - offsetMinutes * 60_000);
}

/** The Zurich-local hour (0-23) at the given instant. */
export function zurichHour(now: Date): number {
  const p = formatParts(now);
  return Number(p.hour) % 24;
}

/** The Zurich-local date at the given instant, formatted 'YYYY-MM-DD'. */
export function zurichDateString(now: Date): string {
  const p = formatParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}
