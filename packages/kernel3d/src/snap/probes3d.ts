import type { NodeId, SnapProbeAt } from '@weasel-js/core';
import { add, dot, scale, type Aabb, type Vec3 } from '@weasel-js/geom/3d';
import { boxAt, measuredBoxAt, withDescendants, worldPoses, type Node3d, type World3d } from '../world';

/** What a 3D move drags, at press. */
export interface Subject3d {
  /** The union of the world boxes of the subject and everything under it,
   *  which moves with it. */
  box: Aabb;
  /** The node whose `translate` the session answers for exactly: the first
   *  of the subject still in the scene, which is the move's lead, so every
   *  other root follows it onto what it snapped to. */
  anchor: { box: Aabb; height: number };
}

export function subjectOf<TData, TLayer extends string>(
  world: World3d<TData, TLayer>, ids: readonly string[], up: Vec3,
): Subject3d | null {
  const { scene } = world;
  const poseOf = worldPoses(scene, 'shown');
  const nodeOf = (id: string) => scene.get(id as NodeId) as Node3d<TData, TLayer> | undefined;
  const lead = ids.find((id) => nodeOf(id) !== undefined);
  if (lead === undefined) return null;
  const leadPose = poseOf(lead as NodeId);
  const anchor = { box: measuredBoxAt(world, nodeOf(lead)!, leadPose), height: dot(up, leadPose.position) };
  let box: Aabb | null = null;
  for (const id of withDescendants(scene, ids)) {
    const node = nodeOf(id);
    const b = node && boxAt(world, node, poseOf(node.id));
    if (b) box = box ? union(box, b) : b;
  }
  return { box: box ?? anchor.box, anchor };
}

function union(a: Aabb, b: Aabb): Aabb {
  return {
    min: { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y), z: Math.min(a.min.z, b.min.z) },
    max: { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y), z: Math.max(a.max.z, b.max.z) },
  };
}

/** Corner `i` of `box`: bit 1 picks max x, bit 2 max y, bit 4 max z. */
export function boxCorner(box: Aabb, i: number): Vec3 {
  return {
    x: i & 1 ? box.max.x : box.min.x,
    y: i & 2 ? box.max.y : box.min.y,
    z: i & 4 ? box.max.z : box.min.z,
  };
}

/** A move's probes: the box's 8 corners and center as its geometry, and its
 *  min, center and max as its box. */
export function boxProbes(box: Aabb): SnapProbeAt<Vec3>[] {
  const center = scale(add(box.min, box.max), 0.5);
  const out: SnapProbeAt<Vec3>[] = [];
  for (let i = 0; i < 8; i++) {
    out.push({ id: `corner:${i}`, at: boxCorner(box, i), role: 'geometry' });
  }
  out.push(
    { id: 'center', at: center, role: 'geometry' },
    { id: 'box.min', at: box.min, role: 'box' },
    { id: 'box.center', at: center, role: 'box' },
    { id: 'box.max', at: box.max, role: 'box' },
  );
  return out;
}
