import { pxExtent } from '@weasel-js/geom';
import type { ActionDeps } from '@weasel-js/routing';
import type { NodeId } from '@weasel-js/core';
import { placeSkeleton, type RigNodeData } from '@weasel-js/core';
import type { Skeleton } from '@weasel-js/animator';

const EMPTY: Skeleton = { joints: [] };

/** A rig node and its skeleton in the scene's space, as the rig tools edit and draw it. */
export interface PlacedRig {
  id: NodeId;
  skeleton: Skeleton;
}

/** The rig at node `id`, an empty skeleton for a node that has none yet, or `null` when
 *  there is no such node. */
export function placedRig(
  scene: { get(id: NodeId): { pose: unknown; data?: unknown } | undefined },
  id: NodeId | null,
): PlacedRig | null {
  const node = id === null ? undefined : scene.get(id);
  if (id === null || !node) return null;
  const local = (node.data as RigNodeData | null | undefined)?.skeleton ?? EMPTY;
  return { id, skeleton: placeSkeleton(local, node.pose) };
}

/** `px` screen pixels as a distance in the scene, at the view's current scale. */
export function sceneReach(deps: ActionDeps, px: number): number {
  const e = pxExtent(px, deps.view?.get().scale ?? { x: 1, y: 1 });
  return Math.max(e.x, e.y);
}
