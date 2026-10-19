/** How long ago something happened, in the shortest unit that reads well: `840ms`, `12.3s`, `4m07s`. */
export function formatAge(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  return `${m}m${String(Math.floor(sec % 60)).padStart(2, '0')}s`;
}
