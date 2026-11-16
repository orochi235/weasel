/** geom's `lerp`, which this package cannot import: exactly `b` at `t = 1`, and finite where `b - a` would overflow. */
export function lerp(a: number, b: number, t: number): number {
  if (t === 1) return b;
  if (a === b) return a;
  const d = b - a;
  return Number.isFinite(d) ? a + d * t : a * (1 - t) + b * t;
}
