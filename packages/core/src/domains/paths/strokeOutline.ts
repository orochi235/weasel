import type { Path } from '@weasel-js/geom';
import { isSilhouettePose } from 'core/geometry/regionHit';
import type { Node } from 'core/scene/types';
import { findShapeSilhouette } from 'canvas/NodeShape';

/** The outline `node` is drawn with, in world coords: its pose when the pose
 *  is a polygon, else its painter's silhouette. Null for a node with neither. */
export function nodeOutline(node: Node<unknown, string, unknown>): Path | null {
  const pose = node.pose;
  if (isSilhouettePose(pose)) return pose;
  return findShapeSilhouette(node, pose);
}
