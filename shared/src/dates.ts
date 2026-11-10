/** "24/12/2026", the way dates are written in Vietnam. */
export function formatDay(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  if (start && end)
    return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
  if (start) return `From ${formatDay(start)}`;
  if (end) return `Until ${formatDay(end)}`;
  return null;
}
