/** Where cubic segments cross one another, as a parameter on each. */
import { boxesIntersect } from '../box';
import { cubicEvalAt } from '../curve';
import type { CubicSegment } from './cubicContours';

type Pt = [number, number];
type C = CubicSegment['c'];

/** One crossing of segments `a` and `b`, at parameter `s` on `a` and `t` on `b`. */
export interface SegmentCrossing {
  a: number;
  b: number;
  s: number;
  t: number;
}

const STEPS = 16;
const END = 1e-7;

/**
 * Every crossing between two of `segs`, a segment with itself left out. A
 * meeting at an end of both is a shared corner, not a crossing, and is left
 * out too. Each curve is found on a flattening and then refined on the curves.
 */
export function segmentCrossings(segs: readonly CubicSegment[]): SegmentCrossing[] {
  const flat = segs.map((s) => flatten(s));
  const boxes = flat.map(boxOf);
  const out: SegmentCrossing[] = [];
  for (let a = 0; a < segs.length; a++) {
    for (let b = a + 1; b < segs.length; b++) {
      if (!boxesIntersect(boxes[a]!, boxes[b]!)) continue;
      const pa = flat[a]!,
        pb = flat[b]!;
      for (let i = 0; i + 1 < pa.length; i++) {
        for (let j = 0; j + 1 < pb.length; j++) {
          const hit = linesCross(pa[i]!, pa[i + 1]!, pb[j]!, pb[j + 1]!);
          if (hit === null) continue;
          const guess: Pt = [(i + hit[0]) / (pa.length - 1), (j + hit[1]) / (pb.length - 1)];
          const [s, t] = segs[a]!.line && segs[b]!.line ? guess : refine(segs[a]!.c, segs[b]!.c, guess);
          if (atEnd(s) && atEnd(t)) continue;
          if (out.some((x) => x.a === a && x.b === b && Math.abs(x.s - s) < 1e-6 && Math.abs(x.t - t) < 1e-6)) continue;
          out.push({ a, b, s, t });
        }
      }
    }
  }
  return out;
}

const atEnd = (t: number) => t < END || t > 1 - END;

function flatten(seg: CubicSegment): Pt[] {
  if (seg.line) return [[seg.c[0], seg.c[1]], [seg.c[6], seg.c[7]]];
  const out: Pt[] = [];
  for (let i = 0; i <= STEPS; i++) out.push(cubicEvalAt(...seg.c, i / STEPS));
  return out;
}

type Box = [number, number, number, number];

function boxOf(pts: readonly Pt[]): Box {
  const b: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    b[0] = Math.min(b[0], x);
    b[1] = Math.min(b[1], y);
    b[2] = Math.max(b[2], x);
    b[3] = Math.max(b[3], y);
  }
  return b;
}

function linesCross(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const rx = b[0] - a[0],
    ry = b[1] - a[1],
    sx = d[0] - c[0],
    sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-18) return null;
  const u = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den;
  const w = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
  return u >= 0 && u <= 1 && w >= 0 && w <= 1 ? [u, w] : null;
}

/** The crossing near `guess` found on the curves themselves by Newton's
 *  method, or `guess` when that does not converge on a closer one. */
function refine(a: C, b: C, guess: Pt): Pt {
  const gap = (s: number, t: number) => {
    const p = cubicEvalAt(...a, s),
      q = cubicEvalAt(...b, t);
    return [p[0] - q[0], p[1] - q[1]] as Pt;
  };
  let [s, t] = guess;
  let f = gap(s, t);
  const start = Math.hypot(...f);
  for (let k = 0; k < 8 && Math.hypot(...f) > 1e-13; k++) {
    const da = derivative(a, s),
      db = derivative(b, t);
    const det = -da[0] * db[1] + db[0] * da[1];
    if (Math.abs(det) < 1e-18) break;
    s = Math.min(1, Math.max(0, s - (-db[1] * f[0] + db[0] * f[1]) / det));
    t = Math.min(1, Math.max(0, t - (-da[1] * f[0] + da[0] * f[1]) / det));
    f = gap(s, t);
  }
  return Math.hypot(...f) <= start ? [s, t] : guess;
}

function derivative(c: C, t: number): Pt {
  const u = 1 - t;
  const a = 3 * u * u,
    b = 6 * u * t,
    e = 3 * t * t;
  return [
    a * (c[2] - c[0]) + b * (c[4] - c[2]) + e * (c[6] - c[4]),
    a * (c[3] - c[1]) + b * (c[5] - c[3]) + e * (c[7] - c[5]),
  ];
}
