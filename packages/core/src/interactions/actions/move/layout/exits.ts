import type { NodeId } from 'core/scene/types';
import { poseDescriptorForNode } from 'core/geometry/poseDescriptor';
import { toPlane } from 'core/viewport/parallax';
import { composeWorldPose } from 'core/scene/composePose';
import { sceneViewPoseAdapter } from 'core/scene/scenePoseAdapter';
import type { LayoutStrategy } from '../../../../layout/types';
import { planeOf } from '../../planeInput';
import type { MoveSession } from '../session';
import { rectContainsPointHalfOpen } from '@weasel-js/geom';

/** Where each dragged root that leaves its layout container on release lands.
 *  A root leaves when the drop center falls outside the body of the layout
 *  container holding it, and lands under the innermost plain container beneath
 *  the drop that admits it (`canDropInto`) — a layout container there has
 *  already declined it — or at the top level of its layer. A root whose parent
 *  has no layout is not this pass's to move; `reparentOnDrop` decides for those. */
export function resolveLayoutExits(
  session: MoveSession, dropCenter: { x: number; y: number } | null, ids: Iterable<NodeId>,
): Map<NodeId, NodeId | null> {
  const out = new Map<NodeId, NodeId | null>();
  const layoutDep = session.layout;
  const center = dropCenter;
  if (!layoutDep || !center) return out;
  const { scene, pc, projection: d } = session;
  const poseAdapter = sceneViewPoseAdapter(scene);
  const excluded = new Set<NodeId>([...session.ids, ...session.cascadeIds]);
  const holds = (id: NodeId, layout: LayoutStrategy<unknown> | null): boolean => {
    const node = scene.get(id)!;
    const plane = planeOf(session.view, node.layer);
    const at = plane ? toPlane(plane, center) : center;
    const pose = composeWorldPose(poseAdapter, id as string, pc.compose);
    if (layout?.contains) return layout.contains(pose, at);
    const b = poseDescriptorForNode(d, node).getBounds(pose);
    return rectContainsPointHalfOpen(b, at.x, at.y);
  };
  const landings = new Map<string, NodeId | null>();
  const landingOn = (layer: string): NodeId | null => {
    if (landings.has(layer)) return landings.get(layer)!;
    // Deepest wins; among equals, the later sibling (painted over the other).
    let best: NodeId | null = null;
    let bestDepth = -1;
    const walk = (parentId: NodeId | null, depth: number): void => {
      for (const id of parentId === null ? scene.roots : scene.childrenOf(parentId)) {
        if (excluded.has(id)) continue;
        const node = scene.get(id);
        if (!node) continue;
        if (node.layer === layer && depth >= bestDepth
          && layoutDep.getLayout(id as string) === null && holds(id, null) && session.admits(id)) {
          best = id;
          bestDepth = depth;
        }
        walk(id, depth + 1);
      }
    };
    walk(null, 0);
    landings.set(layer, best);
    return best;
  };
  for (const id of ids) {
    const node = scene.get(id);
    const parent = node?.parent ?? null;
    if (!node || parent === null) continue;
    const layout = layoutDep.getLayout(parent as string);
    if (!layout || holds(parent, layout)) continue;
    out.set(id, landingOn(node.layer));
  }
  return out;
}
