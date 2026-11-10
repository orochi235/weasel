import type { NodeId, Scene } from 'core/scene/types';

type AnyScene = Scene<unknown, string, unknown>;

/** `nodes` in the order they paint, back to front, whatever order they were selected in. */
export function inPaintOrder<N extends { id: string }>(scene: AnyScene, nodes: readonly N[]): N[] {
  const order = new Map([...scene.renderOrder()].map((id, i) => [id as string, i]));
  return [...nodes].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** The slot among `parent`'s children a new container takes to stand in `front`'s place: just
 *  above `front`, or above the child of `parent` that `front` lies under, so what stacked above every
 *  member still does. Undefined, the end, when `front` is not under `parent`. */
export function slotAbove(scene: AnyScene, parent: NodeId | null, front: string): number | undefined {
  let branch: NodeId | null = front as NodeId;
  while (branch !== null && (scene.get(branch)?.parent ?? null) !== parent) branch = scene.get(branch)?.parent ?? null;
  if (branch === null) return undefined;
  const at = (parent === null ? scene.roots : scene.childrenOf(parent)).indexOf(branch);
  return at >= 0 ? at + 1 : undefined;
}
