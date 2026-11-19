/** The UTC calendar day of an ISO timestamp, as `YYYY-MM-DD`. */
export function isoDay(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** How long ago an ISO timestamp was: "today", "3d ago", "2w ago", then its UTC month, "Apr 2024", which does not
 *  drift as the page sits. The month is the one {@link isoDay}'s day falls in, wherever the reader is. */
export function ageOf(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ms < day) return 'today';
  const days = Math.floor(ms / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
