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
