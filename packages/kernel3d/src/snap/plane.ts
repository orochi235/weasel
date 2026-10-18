import type { SnapConstrain } from '@weasel-js/core';
import type { Flat } from '@weasel-js/geom/nd';
import { add, cross, dot, normalize, scale, sub, type Vec3 } from '@weasel-js/geom/3d';

const AXIS_STEP = Math.PI / 4;
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export const tuple = (p: Vec3): number[] => [p.x, p.y, p.z];
export const vec3Of = (t: readonly number[]): Vec3 => ({ x: t[0]!, y: t[1]!, z: t[2]! });

/** Two unit directions spanning the plane normal to `up`. For an axis `up`
 *  they are the other two world axes, so a ground grid runs along them. */
export function planeBasis(up: Vec3): readonly [Vec3, Vec3] {
  const n = normalize(up);
  const e: Vec3 = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const u = normalize(sub(e, scale(n, dot(n, e))));
  return [u, cross(u, n)];
}

/**
 * `H` for a 3D gesture: the plane `basis` spans, through the origin of
 * δ-space. While `snap.constrain` is held, an `'axis'` constraint holds δ to
 * the axes and diagonals of that plane, and an angle step holds it to the
 * line through `about` at the nearest multiple of the step.
 */
export function inputFlat3d(
  c: SnapConstrain | undefined, held: boolean, basis: readonly [Vec3, Vec3], delta0: Vec3, about: Vec3,
): Flat {
  const [u, v] = basis;
  if (!held || c === undefined || c === 'aspect') return { at: [0, 0, 0], dirs: [tuple(u), tuple(v)] };
  const step = c === 'axis' ? AXIS_STEP : c.step;
  const from = c === 'axis' ? ZERO : about;
  const d = sub(delta0, from);
  const a = dot(d, u);
  const b = dot(d, v);
  const theta = a === 0 && b === 0 ? 0 : Math.round(Math.atan2(b, a) / step) * step;
  return { at: tuple(from), dirs: [tuple(add(scale(u, Math.cos(theta)), scale(v, Math.sin(theta))))] };
}
