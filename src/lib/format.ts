/** Swiss number formatting: 3200 -> "3'200" */
function chf(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatCHF(n: number): string {
  return `CHF ${chf(n)}`;
}

/** Swiss-grouped number only, no currency prefix — for composing with an
 * i18n string that already supplies its own "CHF"/"ab CHF"/"dès CHF" copy. */
export function formatChfAmount(n: number): string {
  return chf(n);
}

export function formatCHFRange(min: number, max: number): string {
  return `CHF ${chf(min)} – ${chf(max)}`;
}

/** "2026-08-14" -> "14.08.2026" */
export function formatSwissDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

// Times and day boundaries are computed in Swiss time, identically on the
// server (Vercel runs in UTC) and in the browser; reading the runtime's own
// zone made server-rendered times 1-2 h off and disagree with the client.
const ZURICH_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function zurichParts(at: string | Date) {
  const p = Object.fromEntries(
    ZURICH_PARTS.formatToParts(new Date(at)).map((part) => [part.type, part.value])
  );
  return { y: p.year, m: p.month, d: p.day, h: p.hour === "24" ? "00" : p.hour, min: p.minute };
}

/** "HH:MM" in Swiss time. */
export function formatClockTime(iso: string): string {
  const z = zurichParts(iso);
  return `${z.h}:${z.min}`;
}

/** Swiss calendar day ("YYYY-MM-DD") of an instant, for day separators. */
export function zurichDayKey(iso: string): string {
  const z = zurichParts(iso);
  return `${z.y}-${z.m}-${z.d}`;
}

/**
 * Compact, locale-neutral timestamp for message/conversation lists, in
 * Swiss time: same day -> "HH:MM", this year -> "dd.MM.", older -> "dd.MM.yy".
 */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const z = zurichParts(iso);
  const n = zurichParts(now);
  if (z.y === n.y && z.m === n.m && z.d === n.d) return `${z.h}:${z.min}`;
  const dm = `${z.d}.${z.m}.`;
  return z.y === n.y ? dm : `${dm}${z.y.slice(2)}`;
}
