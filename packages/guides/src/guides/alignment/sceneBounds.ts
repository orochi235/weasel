import {
  AUTO_POSE_DESCRIPTOR,
  type Bounds,
  type NodeId,
  nodeGates,
  type PoseDescriptor,
  type Scene,
  scenePoseFrame,
  unionAABB,
  visualBoundsViaDescriptor,
} from '@weasel-js/core';


/** Options shared by the scene readers below. */
export interface SceneBoundsOptions {
  /** How to read a pose's box. Pass the canvas's, so these agree with what it
   *  draws. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<unknown>;
}

/** The world box each id is drawn in, rotation included, skipping ids the
 *  scene no longer holds. Read through the scene's composition. */
export function worldBoundsOf(
  scene: Scene<unknown, string, unknown>,
  ids: Iterable<NodeId>,
  opts: SceneBoundsOptions = {},
): Bounds[] {
  const d = opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR;
  const frame = scenePoseFrame(scene);
  const out: Bounds[] = [];
  for (const id of ids) {
    if (scene.get(id) === undefined) continue;
    out.push(visualBoundsViaDescriptor(frame.world(id), d));
  }
  return out;
}

/** The union of `ids`' world boxes, or null when none is in the scene. */
export function worldUnionOf(
  scene: Scene<unknown, string, unknown>,
  ids: Iterable<NodeId>,
  opts: SceneBoundsOptions = {},
): Bounds | null {
  const boxes = worldBoundsOf(scene, ids, opts);
  return boxes.length === 0 ? null : unionAABB(boxes);
}

/**
 * The world boxes of `ids`' siblings — every node sharing a parent with one
 * of them, outside the set, and not hidden (`nodeGates`). What an equal-spacing snap
 * measures gaps between while `ids` move: `alignMoveBehavior`'s
 * `getSpacingTargets`.
 */
export function siblingBounds(
  scene: Scene<unknown, string, unknown>,
  ids: readonly NodeId[],
  opts: SceneBoundsOptions = {},
): Bounds[] {
  const moving = new Set(ids);
  const gates = nodeGates(scene);
  const parents = new Set<NodeId | null>();
  for (const id of ids) {
    const node = scene.get(id);
    if (node !== undefined) parents.add(node.parent);
  }
  const siblings: NodeId[] = [];
  for (const parent of parents) {
    for (const id of parent === null ? scene.roots : scene.childrenOf(parent)) {
      const node = scene.get(id);
      if (moving.has(id) || node === undefined || gates.hidden(id)) continue;
      siblings.push(id);
    }
  }
  return worldBoundsOf(scene, siblings, opts);
}
