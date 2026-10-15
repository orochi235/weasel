import type { PenAnchor } from './anchors';
import { cubicPointAt, type Point } from './cubicMath';
import { fitCubicWithTangents } from './schneiderFit';

const SAMPLES_PER_SEGMENT = 16;
const SPLIT_SEARCH_STEPS = 40;

/**
 * Controls for the one cubic that replaces `prev → removed → next` when
 * `removed` is deleted. The new controls keep the directions the curve leaves
 * `prev` and arrives at `next` with, and their lengths are least-squares fitted
 * to samples of the two segments being replaced, so the curve keeps its shape
 * as closely as one cubic can. Where `removed` was inserted by splitting a
 * cubic, the original cubic comes back.
 */
export function fitCubicThroughDeletion(
  prev: PenAnchor,
  removed: PenAnchor,
  next: PenAnchor,
): { c1: Point; c2: Point } {
  const first = segmentControls(prev, removed);
  const second = segmentControls(removed, next);
  const samples = [...sampleCubic(first), ...sampleCubic(second).slice(1)];
  const tStart = startTangent(first);
  const tEnd = startTangent(reversed(second));

  // Each half is sampled evenly in its own parameter, so on the merged curve
  // the samples sit at a piecewise-linear parameter that breaks at the
  // removed anchor's `s`. Search for the `s` the samples fit best.
  const fitAt = (s: number) => {
    const params = splitParams(s);
    const fit = fitCubicWithTangents(samples, tStart, tEnd, { params, passes: 0 });
    return { fit, error: squaredError(samples, params, prev, fit.cp1, fit.cp2, next) };
  };
  let lo = 0.02;
  let hi = 0.98;
  const phi = (Math.sqrt(5) - 1) / 2;
  let m1 = hi - phi * (hi - lo);
  let m2 = lo + phi * (hi - lo);
  let e1 = fitAt(m1).error;
  let e2 = fitAt(m2).error;
  for (let i = 0; i < SPLIT_SEARCH_STEPS; i++) {
    if (e1 < e2) {
      hi = m2; m2 = m1; e2 = e1;
      m1 = hi - phi * (hi - lo); e1 = fitAt(m1).error;
    } else {
      lo = m1; m1 = m2; e1 = e2;
      m2 = lo + phi * (hi - lo); e2 = fitAt(m2).error;
    }
  }
  const { cp1, cp2 } = fitCubicWithTangents(samples, tStart, tEnd, {
    params: splitParams((lo + hi) / 2),
  });
  return { c1: cp1, c2: cp2 };
}

type Cubic = [Point, Point, Point, Point];

function splitParams(s: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) out.push((s * i) / SAMPLES_PER_SEGMENT);
  for (let i = 1; i <= SAMPLES_PER_SEGMENT; i++) out.push(s + ((1 - s) * i) / SAMPLES_PER_SEGMENT);
  return out;
}

function squaredError(
  samples: readonly Point[],
  params: readonly number[],
  p0: Point, p1: Point, p2: Point, p3: Point,
): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const q = cubicPointAt(p0, p1, p2, p3, params[i]);
    sum += (q.x - samples[i].x) ** 2 + (q.y - samples[i].y) ** 2;
  }
  return sum;
}

function segmentControls(a: PenAnchor, b: PenAnchor): Cubic {
  return [
    { x: a.x, y: a.y },
    a.outHandle ?? { x: a.x, y: a.y },
    b.inHandle ?? { x: b.x, y: b.y },
    { x: b.x, y: b.y },
  ];
}

function sampleCubic([p0, p1, p2, p3]: Cubic): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) {
    out.push(cubicPointAt(p0, p1, p2, p3, i / SAMPLES_PER_SEGMENT));
  }
  return out;
}

function reversed([p0, p1, p2, p3]: Cubic): Cubic {
  return [p3, p2, p1, p0];
}

/** Unit direction the cubic leaves `p0` in: toward the first control that is
 *  not on top of it, the way a cubic's derivative degenerates. */
function startTangent([p0, ...rest]: Cubic): Point {
  for (const p of rest) {
    const dx = p.x - p0.x;
    const dy = p.y - p0.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-9) return { x: dx / len, y: dy / len };
  }
  return { x: 0, y: 0 };
}
