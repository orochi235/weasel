// A polyline through 16px 1x pixel centers with each inner corner rounded to radius `r`, as path data. Run on
// the axes and the pixel diagonals, its straight stretches stay crisp at 1x, where a cubic S-curve drawn as
// one sweep renders as a gray diagonal.
import { px } from '../../icons/scripts/lib/base.mjs';

const n = (v) => Math.round(v * 1e4) / 1e4;

/** `points` are `[column, row]` pixel indices; `r` is in viewBox units. */
export function rounded(points, r) {
  const p = points.map(([c, w]) => [px(c), px(w)]);
  let d = `M${n(p[0][0])} ${n(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b, c] = [p[i - 1], p[i], p[i + 1]];
    const u = [b[0] - a[0], b[1] - a[1]];
    const v = [c[0] - b[0], c[1] - b[1]];
    const lu = Math.hypot(...u);
    const lv = Math.hypot(...v);
    const turn = Math.acos(Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)));
    const t = r * Math.tan(turn / 2);
    const s = [b[0] - (u[0] / lu) * t, b[1] - (u[1] / lu) * t];
    const e = [b[0] + (v[0] / lv) * t, b[1] + (v[1] / lv) * t];
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += `L${n(s[0])} ${n(s[1])}A${r} ${r} 0 0 ${sweep} ${n(e[0])} ${n(e[1])}`;
  }
  const z = p[p.length - 1];
  return `${d}L${n(z[0])} ${n(z[1])}`;
}
