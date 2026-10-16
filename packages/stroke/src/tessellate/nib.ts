import type { Polyline } from '@weasel-js/geom/tessellate';
import type { StrokeNib } from '@weasel-js/paint';
import type { WidthScale } from './vertexWidths';

/**
 * What a nib does to a stroke's width moving along the unit direction
 * `(tx, ty)`: an elliptical pen whose long axis is the nib's edge, `1` moving
 * across it and `nib.ratio` moving along it. `angle` is counterclockwise on a
 * y-down screen, so the edge points along `(cos, -sin)`.
 */
export function nibWidthScale(nib: StrokeNib): WidthScale {
  const ex = Math.cos(nib.angle), ey = -Math.sin(nib.angle);
  const r = Math.min(1, Math.max(0, nib.ratio));
  return (tx, ty) => {
    const across = ex * ty - ey * tx;
    const along = ex * tx + ey * ty;
    return Math.sqrt(across * across + r * r * along * along);
  };
}

/**
 * Scale `pl`'s widths (its own, or `base` where it has none), and each side's
 * share of them, by the nib at
 * each segment's direction. A corner takes two coincident points, the end of
 * the segment into it and the start of the one out, so each side of a join
 * keeps its own width; the ribbon drops the zero-length span between them.
 * Mutates `pl`.
 */
export function applyNib(pl: Polyline, nib: StrokeNib, base: number): void {
  const n = pl.points.length / 2;
  if (n < 2) return;
  const P = pl.points;
  const scale = nibWidthScale(nib);
  const segCount = pl.closed ? n : n - 1;
  const factors: number[] = [];
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    const dx = P[j * 2] - P[i * 2], dy = P[j * 2 + 1] - P[i * 2 + 1];
    const len = Math.hypot(dx, dy);
    factors.push(len > 0 ? scale(dx / len, dy / len) : NaN);
  }
  // A zero-length segment takes the direction of the one before it.
  for (let i = 0; i < segCount; i++) {
    if (Number.isNaN(factors[i])) factors[i] = i > 0 ? factors[i - 1] : (factors.find((f) => !Number.isNaN(f)) ?? 1);
  }
  const A = pl.anchorA, B = pl.anchorB, T = pl.anchorT, W = pl.widths, O = pl.offsets;
  const pts: number[] = [], aA: number[] = [], aB: number[] = [], aT: number[] = [], ws: number[] = [], os: number[] = [];
  const push = (i: number, factor: number) => {
    pts.push(P[i * 2], P[i * 2 + 1]);
    aA.push(A ? A[i] : 0); aB.push(B ? B[i] : 0); aT.push(T ? T[i] : 0);
    ws.push((W ? W[i] : base) * factor);
    if (O) os.push(O[i] * factor);
  };
  push(0, factors[0]);
  for (let i = 1; i < n; i++) {
    push(i, factors[i - 1]);
    if (i < segCount) push(i, factors[i]);
  }
  if (pl.closed) push(0, factors[segCount - 1]);
  pl.points = pts;
  pl.anchorA = Uint32Array.from(aA);
  pl.anchorB = Uint32Array.from(aB);
  pl.anchorT = Float32Array.from(aT);
  pl.widths = Float32Array.from(ws);
  if (O) pl.offsets = Float32Array.from(os);
}
