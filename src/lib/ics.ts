// Minimal, dependency-free iCalendar (.ics) builder for a booked shoot. The shoot
// has a date but no time, so we emit an all-day VEVENT (DTSTART;VALUE=DATE).

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** `2026-08-14` -> `20260814` (date-only iCal value). */
function icsDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, "");
}

export function buildShootIcs(opts: {
  uid: string;
  title: string;
  date: string; // YYYY-MM-DD
  location?: string;
  description?: string;
  stamp: string; // ISO timestamp for DTSTAMP
}): string {
  const dtstamp =
    opts.stamp.replace(/[-:]/g, "").replace(/\.\d+/, "").replace(/Z?$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rintakez//Shoot//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@rintakez`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${icsDate(opts.date)}`,
    `SUMMARY:${escapeText(opts.title)}`,
    opts.location ? `LOCATION:${escapeText(opts.location)}` : null,
    opts.description ? `DESCRIPTION:${escapeText(opts.description)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  // iCalendar requires CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}
