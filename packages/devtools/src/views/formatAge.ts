/** How long ago something happened, in the shortest unit that reads well: `840ms`, `12.3s`, `4m07s`. */
export function formatAge(ms: number): string {
  const whole = Math.round(ms);
  if (whole < 1000) return `${whole}ms`;
  const tenths = Math.round(ms / 100);
  if (tenths < 600) return `${(tenths / 10).toFixed(1)}s`;
  const sec = Math.round(ms / 1000);
  return `${Math.floor(sec / 60)}m${String(sec % 60).padStart(2, '0')}s`;
}
