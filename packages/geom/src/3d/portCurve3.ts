/**
 * The port-curve rule one dimension up, in `Vec3`. The rule itself lives in
 * `../portCurve`, stated once over components — this wrapper is types and
 * nothing else, so 2D and 3D cannot disagree about what the curve is.
 */

import { PORT_REACH, cubicAt as cubicAtN, portControls as portControlsN } from '../portCurve';
import type { Vec3 } from './vec3';

export { PORT_REACH };

/** `[c1, c2]` for the cubic from `a` to `b`. A null normal falls back to a lerp
 *  along the chord; see `../portCurve` for why the two ends differ. */
export function portControls(
  a: Vec3,
  b: Vec3,
  outNormal: Vec3 | null | undefined,
  inNormal: Vec3 | null | undefined,
  reach: number = PORT_REACH,
): [Vec3, Vec3] {
  const [c1, c2] = portControlsN(a, b, outNormal, inNormal, reach);
  return [
    [c1[0]!, c1[1]!, c1[2]!],
    [c2[0]!, c2[1]!, c2[2]!],
  ];
}

/** A port curve sampled into `samples` points, excluding its start. */
export function portCurvePoints(
  a: Vec3,
  b: Vec3,
  outNormal: Vec3 | null | undefined,
  inNormal: Vec3 | null | undefined,
  samples: number,
  reach: number = PORT_REACH,
): Vec3[] {
  const [c1, c2] = portControlsN(a, b, outNormal, inNormal, reach);
  const out: Vec3[] = [];
  for (let s = 1; s <= samples; s++) {
    const p = cubicAtN(a, c1, c2, b, s / samples);
    out.push([p[0]!, p[1]!, p[2]!]);
  }
  return out;
}

/** A cubic evaluated at `t`. The 2D barrel's `cubicEvalAt`, one dimension up. */
export function cubicAt(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const p = cubicAtN(p0, p1, p2, p3, t);
  return [p[0]!, p[1]!, p[2]!];
}
