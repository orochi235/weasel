/**
 * Shortening a flattened subpath so a filled marker is not speared by its own
 * line. SVG has no equivalent — it paints the marker over a full-length
 * stroke — so this is the one place our rendering deliberately differs.
 *
 * Runs before dash splitting, so a dash pattern fits the visible line rather
 * than running off under the head. The anchor-param interpolation matches
 * `splitForDash`'s rule for a boundary landing mid-segment.
 */

import type { Polyline } from './polyline';

const EPS = 1e-9;

interface Sample {
  x: number; y: number;
  a: number; b: number; t: number;
  w: number;
  /** Index of the first original point at or after this sample. */
  next: number;
}

function sampleAt(
  pl: Polyline, cum: Float64Array,
  A: Uint32Array, B: Uint32Array, T: Float32Array, W: Float32Array | undefined,
  dist: number,
): Sample {
  const n = cum.length;
  let i = 1;
  while (i < n - 1 && cum[i] < dist) i++;
  const segStart = cum[i - 1];
  const segLen = cum[i] - segStart;
  const f = segLen > EPS ? (dist - segStart) / segLen : 0;

  const px = pl.points[(i - 1) * 2], py = pl.points[(i - 1) * 2 + 1];
  const qx = pl.points[i * 2], qy = pl.points[i * 2 + 1];

  let a: number, b: number, t: number;
  if (A[i - 1] === A[i] && B[i - 1] === B[i]) {
    a = A[i - 1]; b = B[i - 1];
    t = T[i - 1] + (T[i] - T[i - 1]) * f;
  } else if (f < 0.5) {
    a = A[i - 1]; b = B[i - 1]; t = T[i - 1];
  } else {
    a = A[i]; b = B[i]; t = T[i];
  }

  const w = W ? W[i - 1] + (W[i] - W[i - 1]) * f : 0;
  return { x: px + (qx - px) * f, y: py + (qy - py) * f, a, b, t, w, next: i };
}

/**
 * Shorten `pl` by `startInset` from its first point and `endInset` from its
 * last, both in the same world units as the points.
 *
 * Returns `pl` itself when there is nothing to do (both insets zero, or the
 * subpath is closed and so has no free ends), and `null` when the insets
 * consume the whole run — a caller should then draw no ribbon at all.
 */
export function trimPolyline(
  pl: Polyline,
  startInset: number,
  endInset: number,
): Polyline | null {
  const from = Math.max(0, startInset);
  const to = Math.max(0, endInset);
  if (from <= 0 && to <= 0) return pl;
  if (pl.closed) return pl;

  const n = pl.points.length / 2;
  if (n < 2) return null;

  const A = pl.anchorA ?? new Uint32Array(n);
  const B = pl.anchorB ?? new Uint32Array(n);
  const T = pl.anchorT ?? new Float32Array(n);
  const W = pl.widths;

  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dx = pl.points[i * 2] - pl.points[(i - 1) * 2];
    const dy = pl.points[i * 2 + 1] - pl.points[(i - 1) * 2 + 1];
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
  }
  const total = cum[n - 1];
  const cutA = from;
  const cutB = total - to;
  if (cutB - cutA <= EPS) return null;

  const head = sampleAt(pl, cum, A, B, T, W, cutA);
  const tail = sampleAt(pl, cum, A, B, T, W, cutB);

  const points: number[] = [head.x, head.y];
  const aOut: number[] = [head.a];
  const bOut: number[] = [head.b];
  const tOut: number[] = [head.t];
  const wOut: number[] | undefined = W ? [head.w] : undefined;

  for (let i = head.next; i < tail.next; i++) {
    points.push(pl.points[i * 2], pl.points[i * 2 + 1]);
    aOut.push(A[i]); bOut.push(B[i]); tOut.push(T[i]);
    if (wOut) wOut.push(W![i]);
  }

  points.push(tail.x, tail.y);
  aOut.push(tail.a); bOut.push(tail.b); tOut.push(tail.t);
  if (wOut) wOut.push(tail.w);

  return {
    points,
    closed: false,
    anchorA: new Uint32Array(aOut),
    anchorB: new Uint32Array(bOut),
    anchorT: new Float32Array(tOut),
    ...(wOut ? { widths: new Float32Array(wOut) } : {}),
  };
}
