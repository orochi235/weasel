import { mat3 } from '@weasel-js/geom';
import { resolveSkeleton } from './resolveSkeleton';
import type { Skin } from './skin';
import { IDENTITY_JOINT, type Joint, type Skeleton } from './types';

/** Where each joint rests, in the skeleton's space and in its order. */
export function jointPositions(skeleton: Skeleton): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const [name, m] of resolveSkeleton(skeleton, {})) {
    const [x, y] = mat3.apply(m, 0, 0);
    out.set(name, { x, y });
  }
  return out;
}

/** The joint resting nearest `(x, y)` and no further than `reach` from it, or `null`. */
export function jointAt(skeleton: Skeleton, x: number, y: number, reach: number): string | null {
  let best: string | null = null;
  let bestD = reach;
  for (const [name, p] of jointPositions(skeleton)) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= bestD) {
      best = name;
      bestD = d;
    }
  }
  return best;
}

/** `(x, y)` in the frame `parent`'s children are placed in. */
function inParent(skeleton: Skeleton, parent: string | null, x: number, y: number): [number, number] {
  if (parent == null) return [x, y];
  const world = resolveSkeleton(skeleton, {}).get(parent);
  if (!world) throw new Error(`The skeleton has no joint "${parent}".`);
  const inverse = mat3.invert(world);
  if (!inverse) throw new Error(`Joint "${parent}" is singular at the bind pose.`);
  return mat3.apply(inverse, x, y);
}

/** `skeleton` with `name` resting at `(x, y)`. The joints under it keep their offsets from it,
 *  so they move along. */
export function moveJoint(skeleton: Skeleton, name: string, x: number, y: number): Skeleton {
  const joint = skeleton.joints.find((j) => j.name === name);
  if (!joint) throw new Error(`moveJoint: the skeleton has no joint "${name}".`);
  const [lx, ly] = inParent(skeleton, joint.parent, x, y);
  return {
    joints: skeleton.joints.map((j) => (j === joint ? { ...j, bind: { ...j.bind, x: lx, y: ly } } : j)),
  };
}

/** `skeleton` with a new joint resting at `(x, y)` under `parent`, or as a root for `null`.
 *  Without a `name` it gets the first of `joint`, `joint2`, … not in use. */
export function addJoint(
  skeleton: Skeleton,
  parent: string | null,
  x: number,
  y: number,
  name?: string,
): { skeleton: Skeleton; name: string } {
  const taken = new Set(skeleton.joints.map((j) => j.name));
  let picked = name;
  if (picked === undefined) {
    picked = 'joint';
    for (let n = 2; taken.has(picked); n++) picked = `joint${n}`;
  } else if (taken.has(picked)) {
    throw new Error(`addJoint: the skeleton already has a joint "${picked}".`);
  }
  const [lx, ly] = inParent(skeleton, parent, x, y);
  const joint: Joint = { name: picked, parent, bind: { ...IDENTITY_JOINT, x: lx, y: ly } };
  return { skeleton: { joints: [...skeleton.joints, joint] }, name: picked };
}

/** `skeleton` without `name` and the joints under it, and the names that went. */
export function removeJoint(skeleton: Skeleton, name: string): { skeleton: Skeleton; removed: string[] } {
  const gone = new Set([name]);
  // Topological order: a joint's parent is decided before it is reached.
  for (const j of skeleton.joints) if (j.parent != null && gone.has(j.parent)) gone.add(j.name);
  const removed = skeleton.joints.filter((j) => gone.has(j.name)).map((j) => j.name);
  return { skeleton: { joints: skeleton.joints.filter((j) => !gone.has(j.name)) }, removed };
}

/** `skin` without the weights of `joints`; the same object when it weighs none of them. */
export function dropSkinJoints(skin: Skin, joints: readonly string[]): Skin {
  if (!joints.some((j) => j in skin)) return skin;
  const out: Record<string, readonly number[]> = {};
  for (const j in skin) if (!joints.includes(j)) out[j] = skin[j];
  return out;
}
