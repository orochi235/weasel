import type { Flat } from '@weasel-js/geom/nd';
import { add, sub, type Vec3 } from '@weasel-js/geom/3d';

/**
 * What a 3D snap session reports as `SnapOutcome.landing`: the point a
 * gesture measures from, where it was at press, and the world point the snap
 * put it at. For a move it is the lead node's position; for an insert, the
 * point on the ground the pointer was pressed at.
 *
 * `to` takes a target's own coordinate on every axis that target pins, so a
 * snap to a grid line at 0.5 lands at 0.5 rather than at whatever a screen
 * point cast back onto a plane rounds to.
 */
export interface Landing3d {
  readonly from: Vec3;
  readonly to: Vec3;
}

const AXES = ['x', 'y', 'z'] as const;

/** `landing` as a {@link Landing3d}, or null when it is not one. */
export function landing3dOf(landing: unknown): Landing3d | null {
  if (typeof landing !== 'object' || landing === null) return null;
  const { from, to } = landing as Partial<Landing3d>;
  return isVec3(from) && isVec3(to) ? { from, to } : null;
}

function isVec3(v: unknown): v is Vec3 {
  if (typeof v !== 'object' || v === null) return false;
  const { x, y, z } = v as Partial<Vec3>;
  return typeof x === 'number' && typeof y === 'number' && typeof z === 'number';
}

/** `p` moved the way `from` went to `to`: onto `to` itself when it is `from`. */
export function shiftedBy(p: Vec3, from: Vec3, to: Vec3): Vec3 {
  return p.x === from.x && p.y === from.y && p.z === from.z ? { ...to } : add(p, sub(to, from));
}

/** One candidate a resolution met: the probe it holds and the locus it holds it to. */
interface Met {
  probe: string;
  locus: Flat;
}

/**
 * Where `from` lands under the resolved move `delta`. An axis no input
 * direction moves along keeps `from`'s value. On an axis a met locus pins —
 * none of its directions leave it — `from` keeps its offset from the pinned
 * probe, which lands on the locus's own coordinate.
 */
export function landingOf(
  from: Vec3,
  delta: Vec3,
  inputDirs: readonly (readonly number[])[],
  probes: readonly { id: string; at: Vec3 }[],
  met: readonly Met[],
): Landing3d {
  const to: { -readonly [K in keyof Vec3]: number } = add(from, delta);
  AXES.forEach((axis, k) => {
    if (inputDirs.every((d) => d[k] === 0)) {
      to[axis] = from[axis];
      return;
    }
    for (const m of met) {
      if (m.locus.dirs.some((d) => d[k] !== 0)) continue;
      const q = probes.find((p) => p.id === m.probe);
      if (!q) continue;
      to[axis] = m.locus.at[k]! - (q.at[axis] - from[axis]);
      return;
    }
  });
  return { from, to };
}
