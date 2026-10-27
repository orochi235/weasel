/**
 * What a resized frame holds: a resize changes the box, not where the
 * contents draw, so each node stored in a written frame and not written
 * itself is re-expressed in the frame's new pose.
 */
import { heldInFrame } from 'core/scene/carryDescendants';
import { definesFrame } from 'core/scene/effectivePose';
import type { NodeId, Scene } from 'core/scene/types';
import type { PoseFrame } from '../poseFrame';

/** A node held in place: the frame it is stored in, where it draws, and its
 *  stored pose at press. */
export interface HeldNode {
  readonly frame: NodeId;
  readonly world: unknown;
  readonly from: unknown;
}

/** The nodes stored in a frame among `writeIds` that the resize does not write. */
export function captureHeld(
  scene: Scene<unknown, string, unknown>,
  writeIds: readonly NodeId[],
  poseFrame: PoseFrame<unknown>,
): Map<NodeId, HeldNode> {
  const held = new Map<NodeId, HeldNode>();
  if (poseFrame.pc.closure === 'identity') return held;
  const writing = new Set(writeIds);
  for (const frame of writeIds) {
    const node = scene.get(frame);
    if (!node || !definesFrame(node)) continue;
    for (const id of heldInFrame(scene, frame)) {
      if (writing.has(id) || held.has(id)) continue;
      held.set(id, { frame, world: poseFrame.world(id), from: scene.get(id)!.pose });
    }
  }
  return held;
}

/** `previews` with each held node posed in its frame's previewed pose, so it
 *  stays where it drew. */
export function holdInPlace(
  previews: Map<NodeId, unknown>,
  held: ReadonlyMap<NodeId, HeldNode>,
  poseFrame: PoseFrame<unknown>,
): Map<NodeId, unknown> {
  const { compose, decompose } = poseFrame.pc;
  for (const [id, h] of held) {
    const stored = previews.get(h.frame);
    if (stored === undefined) continue;
    const above = poseFrame.parentWorld(h.frame);
    previews.set(id, decompose(poseFrame.childFrame(h.frame, above === null ? stored : compose(above, stored)), h.world));
  }
  return previews;
}
