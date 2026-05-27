/**
 * Centripetal Catmull-Rom spline sampling. Yuksel/Schneider 2011
 * parameterization (α = 0.5) — passes exactly through every anchor,
 * avoids cusps and self-intersections that uniform Catmull-Rom
 * produces on sharp angles in 2D.
 */

export interface Point {
  x: number;
  y: number;
}

const ALPHA = 0.5;

function knot(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.pow(Math.sqrt(dx * dx + dy * dy), ALPHA);
}

/**
 * Sample the centripetal Catmull-Rom segment between p1 and p2 at
 * parameter t ∈ [0, 1]. p0 and p3 are the surrounding control points
 * (use phantom reflection at endpoints — see sampleCurve below).
 *
 * Returns p1 at t=0 and p2 at t=1.
 */
export function segmentSampleAt(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number,
): Point {
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);

  // Degenerate: coincident p1/p2 → linear interpolation fallback.
  if (t2 - t1 === 0) {
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  }

  const u = t1 + t * (t2 - t1);

  const a1x = ((t1 - u) * p0.x + (u - t0) * p1.x) / (t1 - t0);
  const a1y = ((t1 - u) * p0.y + (u - t0) * p1.y) / (t1 - t0);
  const a2x = ((t2 - u) * p1.x + (u - t1) * p2.x) / (t2 - t1);
  const a2y = ((t2 - u) * p1.y + (u - t1) * p2.y) / (t2 - t1);
  const a3x = ((t3 - u) * p2.x + (u - t2) * p3.x) / (t3 - t2);
  const a3y = ((t3 - u) * p2.y + (u - t2) * p3.y) / (t3 - t2);

  const b1x = ((t2 - u) * a1x + (u - t0) * a2x) / (t2 - t0);
  const b1y = ((t2 - u) * a1y + (u - t0) * a2y) / (t2 - t0);
  const b2x = ((t3 - u) * a2x + (u - t1) * a3x) / (t3 - t1);
  const b2y = ((t3 - u) * a2y + (u - t1) * a3y) / (t3 - t1);

  const cx = ((t2 - u) * b1x + (u - t1) * b2x) / (t2 - t1);
  const cy = ((t2 - u) * b1y + (u - t1) * b2y) / (t2 - t1);
  return { x: cx, y: cy };
}

/**
 * Sample the whole curve through `anchors`. Returns
 * `(n-1) * samplesPerSegment + 1` points. Phantom endpoints by
 * reflection so the first/last segments are tangent to the chord
 * into/out of the endpoints.
 *
 * Returns `[]` for fewer than 2 anchors.
 */
export function sampleCurve(
  anchors: readonly Point[],
  samplesPerSegment: number,
): Point[] {
  if (anchors.length < 2) return [];
  if (samplesPerSegment < 1) samplesPerSegment = 1;

  const n = anchors.length;
  const out: Point[] = [];

  const reflectStart: Point = {
    x: 2 * anchors[0].x - anchors[1].x,
    y: 2 * anchors[0].y - anchors[1].y,
  };
  const reflectEnd: Point = {
    x: 2 * anchors[n - 1].x - anchors[n - 2].x,
    y: 2 * anchors[n - 1].y - anchors[n - 2].y,
  };

  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? reflectStart : anchors[i - 1];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = i + 2 < n ? anchors[i + 2] : reflectEnd;
    const tStart = i === 0 ? 0 : 1;
    for (let s = tStart; s <= samplesPerSegment; s++) {
      if (s === 0) {
        out.push(p1);
        continue;
      }
      if (s === samplesPerSegment) {
        out.push(p2);
        continue;
      }
      const t = s / samplesPerSegment;
      out.push(segmentSampleAt(p0, p1, p2, p3, t));
    }
  }
  return out;
}
