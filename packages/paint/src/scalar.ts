/** geom's `lerp`, which this package cannot import: exactly `b` at `t = 1`, and finite where `b - a` would overflow. */
export function lerp(a: number, b: number, t: number): number {
  if (t === 1) return b;
  if (a === b) return a;
  const d = b - a;
  return Number.isFinite(d) ? a + d * t : a * (1 - t) + b * t;
}

/** geom's `clamp01`, which this package cannot import: `v` held to `0`..`1`, `NaN` passing through. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
