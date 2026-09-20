/**
 * The port-curve rule one dimension up, in `Vec3`. The rule itself lives in
 * `../portCurve`, stated once over components — this wrapper is types and
 * nothing else, so 2D and 3D cannot disagree about what the curve is.
 */

import { PORT_REACH, cubicAt as cubicAtN, portControls as portControlsN } from '../portCurve';
import type { Vec3 } from './vec3';

export { PORT_REACH };

const comps = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];
const compsOrNull = (v: Vec3 | null | undefined) => (v == null ? v : comps(v));
const fromComps = (p: readonly number[]): Vec3 => ({ x: p[0]!, y: p[1]!, z: p[2]! });

/** `[c1, c2]` for the cubic from `a` to `b`. A null normal falls back to a lerp
 *  along the chord; see `../portCurve` for why the two ends differ. */
export function portControls(
  a: Vec3,
  b: Vec3,
  outNormal: Vec3 | null | undefined,
  inNormal: Vec3 | null | undefined,
  reach: number = PORT_REACH,
): [Vec3, Vec3] {
  const [c1, c2] = portControlsN(
    comps(a),
    comps(b),
    compsOrNull(outNormal),
    compsOrNull(inNormal),
    reach,
  );
  return [fromComps(c1), fromComps(c2)];
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
  const [c1, c2] = portControlsN(
    comps(a),
    comps(b),
    compsOrNull(outNormal),
    compsOrNull(inNormal),
    reach,
  );
  const out: Vec3[] = [];
  for (let s = 1; s <= samples; s++) {
    const p = cubicAtN(comps(a), c1, c2, comps(b), s / samples);
    out.push(fromComps(p));
  }
  return out;
}

/** A cubic evaluated at `t`. The 2D barrel's `cubicEvalAt`, one dimension up. */
export function cubicAt(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const p = cubicAtN(comps(p0), comps(p1), comps(p2), comps(p3), t);
  return fromComps(p);
}
