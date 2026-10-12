import type { NodeId } from '@weasel-js/routing';
import type { ContainerBounds } from '../../layout/types';

/** A pose a container's layout wrote — reported by `Scene.onReflow` — in the
 *  node's stored frame. */
export interface LayoutMove<TPose> {
  id: NodeId;
  from: TPose;
  to: TPose;
}

/** How a scene reads and resizes a laid-out container's bounds. */
export interface LayoutFrame<TPose> {
  /** The container's bounds, from its world pose. Default: the pose's own
   *  `x`/`y`/`width`/`height`; a pose without them is not laid out. */
  bounds?(pose: TPose): ContainerBounds | null;
  /** `pose` resized from bounds `from` to `to`, for a layout that grows its
   *  container. Default: `to`'s fields written over the pose. */
  remap?(pose: TPose, from: ContainerBounds, to: ContainerBounds): TPose;
}
