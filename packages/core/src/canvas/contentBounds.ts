import { transformPoint, boundsOfCoords, type Affine } from '@weasel-js/geom';
import { axisAlignedBounds, unionAABB } from 'core/geometry/unionBounds';
import { nodeGates } from 'core/scene/nodeGates';
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { copiesWithin } from './copiesAbove';

/**
 * The world box everything `scene` draws covers: each shown root's box, and
 * each shown container's box carried through every copy it is drawn in, so a
 * group drawing copies (`copiesFromPose`, a symmetry group's say) is framed
 * with all of them. `null` when nothing is drawn. What zoom-to-fit and a
 * minimap frame.
 *
 * `boxOf` answers a node's world box, everything under it included, or null
 * for a node that draws nothing. `poseOf` is the pose a container's copies are
 * computed from, the one it is painted at; default its stored pose. Copies are
 * 2D affines, so this is the box in the scene's plane.
 */
export function sceneContentBounds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  boxOf: (id: NodeId) => Bounds | null,
  poseOf: (node: Node<TData, TLayer, TPose>) => TPose = (node) => node.pose,
): Bounds | null {
  const gates = nodeGates(scene);
  const parts: (Bounds | null)[] = [];
  for (const id of scene.roots) if (!gates.hidden(id)) parts.push(boxOf(id));
  for (const node of scene.nodes.values()) {
    if (!node.copiesFromPose || gates.hidden(node)) continue;
    const copies = copiesWithin(scene, node.id, poseOf);
    if (copies.length === 0) continue;
    const own = boxOf(node.id);
    if (own) for (const m of copies) parts.push(carried(own, m));
  }
  return unionAABB(parts);
}

/** The axis-aligned box `b` covers once carried through `m`. */
function carried(b: Bounds, m: Affine): Bounds | null {
  const { x, y, width, height } = axisAlignedBounds(b);
  const coords: number[] = [];
  for (const [px, py] of [[x, y], [x + width, y], [x, y + height], [x + width, y + height]] as const) {
    coords.push(...transformPoint(m, px, py));
  }
  const box = boundsOfCoords(coords);
  return box && { x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] };
}
