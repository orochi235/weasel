import { applyToPoint, multiply, poseFrameOf, type Affine, type PoseLinear } from '@weasel-js/geom';
import { UNION_OF_CHILDREN, unionOfChildren, type NodeId, type Scene } from '@weasel-js/core';
import { isSymmetryGroup } from './group';
import { keepContentsPut, localPoseUnder, worldPoseOf } from './frames';

type AnyScene = Scene<unknown, string, unknown>;

/** What {@link bakeSymmetry} did. */
export interface BakeResult {
  /** The plain group that replaced the symmetry group. */
  group: NodeId;
  /** Leaves whose pose is not a box, which kept their place but whose
   *  copies were not made. */
  skipped: NodeId[];
}

interface BoxPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  transform?: PoseLinear;
}

const isBox = (pose: unknown): pose is BoxPose => {
  const p = pose as Partial<BoxPose> | null | undefined;
  return typeof p?.x === 'number' && typeof p.y === 'number'
    && typeof p.width === 'number' && typeof p.height === 'number';
};

/** Rounding left by a quarter turn's cosine, and `-0`, would otherwise reach a
 *  saved pose. */
const clean = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : v);

/**
 * `pose` carried through `m`: the same box, centered where `m` takes its
 * center, and a frame that is `m`'s turn or mirror composed with the pose's
 * own. A frame wraps everything the node draws, so text, an image and a paint
 * laid out in the box all land where the live copy drew them.
 */
export function carryPose<P extends BoxPose>(pose: P, m: Affine): P {
  const frame = poseFrameOf(pose) ?? [1, 0, 0, 1, 0, 0];
  const [a, b, c, d] = multiply(m, frame).map(clean);
  const [cx, cy] = applyToPoint(m, pose.x + pose.width / 2, pose.y + pose.height / 2);
  const { rotation: _r, transform: _t, ...rest } = pose;
  const out = { ...rest, x: clean(cx - pose.width / 2), y: clean(cy - pose.height / 2) } as P;
  if (b === 0 && c === 0 && (a > 0 || d > 0)) {
    if (a !== 1 || d !== 1) out.transform = [a, 0, 0, d];
    return out;
  }
  const turn = Math.atan2(b, a);
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  // What is left once the turn is taken back out: a mirror, or a skew the pose already had.
  const t: PoseLinear = [
    clean(cos * a + sin * b), clean(-sin * a + cos * b), clean(cos * c + sin * d), clean(-sin * c + cos * d),
  ];
  out.rotation = turn;
  if (t[0] !== 1 || t[1] !== 0 || t[2] !== 0 || t[3] !== 1) out.transform = t;
  return out;
}

/**
 * Turn symmetry group `id` into a plain group holding its children and, for
 * every copy it drew, a real node: one undo step. A symmetry group nested
 * inside is baked first. A copy keeps its leaf's data, and its pose is
 * carried through the copy's transform by {@link carryPose}; a leaf whose pose
 * is not a box is reported in `skipped`. Returns `null` when `id` is not a
 * symmetry group. In a scene that composes frames, every node stays where it
 * drew.
 */
export function bakeSymmetry(scene: AnyScene, id: NodeId, label = 'Bake symmetry'): BakeResult | null {
  if (!isSymmetryGroup(scene, id)) return null;
  return scene.batch(label, () => bakeInBatch(scene, id));
}

function bakeInBatch(scene: AnyScene, id: NodeId): BakeResult {
  const skipped: NodeId[] = [];
  for (const child of [...scene.childrenOf(id)]) {
    for (const inner of [...descendantGroups(scene, child)].reverse()) skipped.push(...bakeInBatch(scene, inner).skipped);
  }
  const group = scene.get(id)!;
  const copies = group.kind === 'container' && group.copiesFromPose
    ? group.copiesFromPose(worldPoseOf(scene, id), group) ?? [] : [];
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
  keepContentsPut(scene, id, () => {
    for (const child of children) scene.move(child, plain);
  });
  for (const m of copies) {
    for (const child of children) copySubtree(scene, child, m, plain, skipped);
  }
  scene.remove(id);
  return { group: plain, skipped: [...new Set(skipped)] };
}

function descendantGroups(scene: AnyScene, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (n: NodeId): void => {
    if (isSymmetryGroup(scene, n)) out.push(n);
    for (const c of scene.childrenOf(n)) walk(c);
  };
  walk(id);
  return out;
}

/** Add `id`, carried through `m`, under `parent`. */
function copySubtree(scene: AnyScene, id: NodeId, m: Affine, parent: NodeId, skipped: NodeId[]): void {
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
  const world = worldPoseOf(scene, id);
  if (!isBox(world)) {
    skipped.push(id);
    return;
  }
  const pose = localPoseUnder(scene, carryPose(world, m), parent);
  scene.add({ kind: 'leaf', layer: node.layer, pose, data: node.data, parent });
}
