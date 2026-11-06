import type { Path } from '@weasel-js/geom';
import { isSilhouettePose } from 'core/geometry/regionHit';
import type { Node } from 'core/scene/types';
import { findShapeSilhouette } from 'canvas/NodeShape';
import type { NodeSilhouetteCtx } from 'canvas/nodeShapeTypes';

/** The outline `node` is drawn with at `pose` (default its own), in world
 *  coords: the pose when it is a polygon, else its painter's silhouette. Null
 *  for a node with neither. */
export function nodeOutline(
  node: Node<unknown, string, unknown>,
  pose: unknown = node.pose,
  ctx?: NodeSilhouetteCtx,
): Path | null {
  if (isSilhouettePose(pose)) return pose;
  return findShapeSilhouette(node, pose, ctx);
}
