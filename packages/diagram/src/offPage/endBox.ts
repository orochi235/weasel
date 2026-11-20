import { worldPoses, type Bounds, type NodeId, type Scene } from '@weasel-js/core';
import { AUTO_LAYOUT_FRAME, type LayoutFrame } from '../layoutFrame';

/** The box `node` has in document space, which is where pages are: its pose through every ancestor's transform,
 *  read on `frame`. */
export function documentBoundsOf<TPose>(
  scene: Scene<unknown, string, TPose>,
  node: { id: string },
  frame: LayoutFrame<TPose> = AUTO_LAYOUT_FRAME as LayoutFrame<TPose>,
): Bounds {
  return frame.box(worldPoses(scene, 'document')(node.id as NodeId));
}
