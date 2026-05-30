/**
 * Curve-specific hit tests. Generic coord transforms live in
 * `../Plot2D/geometry`; what's here is curve-only (anchor / polyline
 * proximity).
 */
import type { Point } from '../Plot2D/geometry';

/**
 * Nearest-anchor hit test. Anchors are already in plot/screen coords.
 * Returns the index of the nearest anchor whose squared distance to
 * the pointer is ≤ radius². Null if no anchor is within radius.
 */
export function hitTestAnchor(
  anchors: readonly Point[],
  pointer: Point,
  radius: number,
): { index: number } | null {
  const r2 = radius * radius;
  let best: { index: number; d2: number } | null = null;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const dx = a.x - pointer.x;
    const dy = a.y - pointer.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (best === null || d2 < best.d2) best = { index: i, d2 };
  }
  return best ? { index: best.index } : null;
}

/**
 * Hit test against a per-segment sampled polyline. Each entry in
 * `segments` is the sample list for one segment (inclusive of
 * endpoints). Returns segment index + t (∈ [0, 1]) of the closest
 * point on the polyline within radius. Null if nothing is in range.
 *
 * Distance is measured to the line-segment chords between adjacent
 * samples, not just to the samples themselves — so sparse sampling
 * still produces accurate hits along the chord.
 */
export function hitTestCurve(
  segments: readonly (readonly Point[])[],
  pointer: Point,
  radius: number,
): { segIdx: number; t: number } | null {
  const r2 = radius * radius;
  let best: { segIdx: number; t: number; d2: number } | null = null;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const samples = segments[segIdx];
    if (samples.length < 2) continue;
    const last = samples.length - 1;
    for (let i = 0; i < last; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const apx = pointer.x - a.x;
      const apy = pointer.y - a.y;
      const ab2 = abx * abx + aby * aby;
      let u = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
      if (u < 0) u = 0;
      else if (u > 1) u = 1;
      const cx = a.x + u * abx;
      const cy = a.y + u * aby;
      const dx = cx - pointer.x;
      const dy = cy - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const t = (i + u) / last;
      if (best === null || d2 < best.d2) best = { segIdx, t, d2 };
    }
  }
  return best ? { segIdx: best.segIdx, t: best.t } : null;
}
