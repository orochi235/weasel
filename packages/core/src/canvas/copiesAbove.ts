import { multiply, type Affine } from '@weasel-js/geom';
import type { Node, NodeId, Scene } from 'core/scene/types';

/**
 * Every transform content placed in `container` is drawn under besides as
 * authored: the `copiesFromPose` of the container and of each container above
 * it, composed outermost first, the identity left out. Empty for the top of
 * the tree, or when nothing there draws copies. `poseOf` is the pose a
 * container is painted at, which is what its copies are computed from.
 */
export function copiesWithin<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  container: NodeId | null,
  poseOf: (node: Node<TData, TLayer, TPose>) => TPose,
): Affine[] {
  if (container === null || scene.get(container) === undefined) return [];
  let all: Affine[] = [[1, 0, 0, 1, 0, 0]];
  for (const aid of [container, ...scene.ancestorsOf(container)].reverse()) {
    const a = scene.get(aid);
    if (a?.kind !== 'group' || !a.copiesFromPose) continue;
    const copies = a.copiesFromPose(poseOf(a), a) ?? [];
    if (copies.length === 0) continue;
    // A copy at an outer level carries everything inside it, inner copies included.
    all = all.flatMap((m) => [m, ...copies.map((c) => multiply(m, c))]);
  }
  return all.slice(1);
}

/** Every transform the ancestors of `id` draw it under; see {@link copiesWithin}. */
export function copiesAbove<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: NodeId,
  poseOf: (node: Node<TData, TLayer, TPose>) => TPose,
): Affine[] {
  return copiesWithin(scene, scene.get(id)?.parent ?? null, poseOf);
}
