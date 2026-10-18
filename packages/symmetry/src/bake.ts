import {
  boundsOfPath, pathInPoseFrame, pathThroughPoseFrame, transformPath, type Affine, type Path,
} from '@weasel-js/geom';
import { UNION_OF_CHILDREN, unionOfChildren, type NodeId, type Scene, type SceneNode } from '@weasel-js/core';
import { isSymmetryGroup } from './group';


/** What {@link bakeSymmetry} did. */
export interface BakeResult {
  /** The plain group that replaced the symmetry group. */
  group: NodeId;
  /** Leaves drawn by something other than a path in their data — text, an
   *  image — which kept their place but whose copies were not made. */
  skipped: NodeId[];
}

/** A path leaf's outline in world coordinates, or null for a leaf without one. */
function worldPathOf(node: SceneNode<unknown, string, unknown>, pose: unknown): Path | null {
  const path = (node.data as { path?: Path } | null)?.path;
  if (!path || !pose || typeof pose !== 'object') return null;
  return pathThroughPoseFrame(pathInPoseFrame(path, pose as never), pose);
}

/**
 * Turn symmetry group `id` into a plain group holding its children and, for
 * every copy it drew, a real node: one undo step. A symmetry group nested
 * inside is baked first. Copies are made of path leaves, their outline
 * carried through the copy's transform into a pose of its own; a leaf drawn
 * any other way is reported in `skipped`. Returns `null` when `id` is not a
 * symmetry group.
 *
 * Written for a scene of absolute poses, the kit's default, and for the
 * kit's path data, `{ path, fill?, stroke? }`. A paint that is laid out in
 * the shape's own box, a gradient say, is copied as it is.
 */
export function bakeSymmetry(scene: Scene<unknown, string, unknown>, id: NodeId, label = 'Bake symmetry'): BakeResult | null {
  if (!isSymmetryGroup(scene, id)) return null;
  return scene.batch(label, () => bakeInBatch(scene, id));
}

function bakeInBatch(scene: Scene<unknown, string, unknown>, id: NodeId): BakeResult {
  const skipped: NodeId[] = [];
  for (const child of [...scene.childrenOf(id)]) {
    for (const inner of [...descendantGroups(scene, child)].reverse()) skipped.push(...bakeInBatch(scene, inner).skipped);
  }
  const group = scene.get(id)!;
  const copies = group.kind === 'container' && group.copiesFromPose
    ? group.copiesFromPose(group.pose, group) ?? [] : [];
  const index = (group.parent === null ? scene.roots : scene.childrenOf(group.parent)).indexOf(id);
  const plain = scene.add({
    kind: 'container',
    layer: group.layer,
    pose: group.pose,
    data: {},
    parent: group.parent,
    index,
    dependsOn: 'children',
    derivePose: scene.registry.derivePose?.[UNION_OF_CHILDREN] ?? unionOfChildren,
  });
  const children = [...scene.childrenOf(id)];
  for (const child of children) scene.move(child, plain);
  for (const m of copies) {
    for (const child of children) copySubtree(scene, child, m, plain, skipped);
  }
  scene.remove(id);
  return { group: plain, skipped: [...new Set(skipped)] };
}

function descendantGroups(scene: Scene<unknown, string, unknown>, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (n: NodeId): void => {
    if (isSymmetryGroup(scene, n)) out.push(n);
    for (const c of scene.childrenOf(n)) walk(c);
  };
  walk(id);
  return out;
}

/** Add `id`, carried through `m`, under `parent`. */
function copySubtree(scene: Scene<unknown, string, unknown>, id: NodeId, m: Affine, parent: NodeId, skipped: NodeId[]): void {
  const node = scene.get(id);
  if (!node) return;
  if (node.kind === 'container') {
    const sub = scene.add({
      kind: 'container',
      layer: node.layer,
      pose: node.pose,
      data: node.data,
      parent,
      dependsOn: 'children',
      derivePose: scene.registry.derivePose?.[UNION_OF_CHILDREN] ?? unionOfChildren,
    });
    for (const c of scene.childrenOf(id)) copySubtree(scene, c, m, sub, skipped);
    return;
  }
  const world = worldPathOf(node, node.pose);
  if (world === null) {
    skipped.push(id);
    return;
  }
  const path = transformPath(world, m);
  const b = boundsOfPath(path);
  scene.add({
    kind: 'leaf',
    layer: node.layer,
    pose: { x: b.x, y: b.y, width: b.width, height: b.height },
    data: { ...(node.data as object), path },
    parent,
  });
}
