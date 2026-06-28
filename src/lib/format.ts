/** Swiss number formatting: 3200 -> "3'200" */
function chf(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

export function formatCHF(n: number): string {
  return `CHF ${chf(n)}`;
}

export function formatCHFRange(min: number, max: number): string {
  return `CHF ${chf(min)} – ${chf(max)}`;
}

/** "2026-08-14" -> "14.08.2026" */
export function formatSwissDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

/**
 * Compact, locale-neutral timestamp for message/conversation lists:
 * same day -> "HH:MM", this year -> "dd.MM.", older -> "dd.MM.yy".
 */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const dm = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
  return d.getFullYear() === now.getFullYear()
    ? dm
    : `${dm}${String(d.getFullYear()).slice(2)}`;
}
