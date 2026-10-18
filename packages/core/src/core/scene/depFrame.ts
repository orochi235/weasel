/**
 * A dependency's pose in the frame of the node reading it. Under a composing
 * strategy a stored pose is local to its container, so a node deriving from
 * something in another container would otherwise read it in that
 * container's frame and place itself as though the two frames were one.
 */
import { composeWorldPose, composesFrames, frameAtOrAbove, type PoseAdapter, type PoseComposition } from './composeFrame';
import type { NodeId } from './types';

/** The parts of a node the rebase reads. */
interface FramedNode {
  id: NodeId;
  parent?: NodeId | null;
}

/** `(depId, pose) => that pose in `reader`'s frame`, or `null` when every
 *  pose is already in one frame — the absolute-pose model. `poseOf` answers
 *  each node's own, local pose. */
export function depFrameRebase<TPose>(
  composition: PoseComposition<TPose> | undefined,
  reader: FramedNode,
  get: (id: NodeId) => FramedNode | undefined,
  poseOf: (id: NodeId) => TPose,
  definesFrame: (id: NodeId) => boolean,
): ((depId: NodeId, pose: TPose) => TPose) | null {
  if (composition === undefined || !composesFrames(composition)) return null;
  const adapter: PoseAdapter<TPose> = {
    getPose: (id) => poseOf(id as NodeId),
    getParent: (id) => get(id as NodeId)?.parent ?? null,
    definesFrame: (id) => definesFrame(id as NodeId),
  };
  const frame = frameAtOrAbove(adapter, reader.parent ?? null);
  return (depId, pose) => {
    const own = frameAtOrAbove(adapter, get(depId)?.parent ?? null);
    if (own === frame) return pose;
    const world = own === null ? pose : composition.compose(composeWorldPose(adapter, own, composition.compose), pose);
    return frame === null ? world : composition.decompose(composeWorldPose(adapter, frame, composition.compose), world);
  };
}
