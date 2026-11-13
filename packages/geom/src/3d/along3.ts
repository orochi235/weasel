/**
 * Length-table queries one dimension up, in `Vec3`. The table and its math
 * live in `../along`, stated over components; this wrapper is types only.
 */

import type { LengthTable } from '../along/lengthTable';
import { pointAtLength as pointAtLengthN } from '../along/positions';
import type { Vec3 } from './vec3';

const fromComps = (p: readonly number[]): Vec3 => ({ x: p[0]!, y: p[1]!, z: p[2]! });

/** The point at pen-order length `s` and the unit tangent there; see the root barrel's `pointAtLength`. */
export function pointAtLength(t: LengthTable, s: number): { point: Vec3; tangent: Vec3 } {
  const { point, tangent } = pointAtLengthN(t, s);
  return { point: fromComps(point), tangent: fromComps(tangent) };
}
