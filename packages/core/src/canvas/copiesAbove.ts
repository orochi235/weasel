import { multiply, type Affine } from '@weasel-js/geom';
import type { Node, NodeId, Scene } from 'core/scene/types';

/**
 * Every transform the ancestors of `id` draw it under besides as authored:
 * each ancestor's `copiesFromPose`, composed outermost first, the identity
 * left out. Empty when no ancestor draws copies. `poseOf` is the pose an
 * ancestor is painted at, which is what its copies are computed from.
 */
export function copiesAbove<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  id: NodeId,
  poseOf: (node: Node<TData, TLayer, TPose>) => TPose,
): Affine[] {
  let all: Affine[] = [[1, 0, 0, 1, 0, 0]];
  const outermostFirst = [...scene.ancestorsOf(id)].reverse();
  for (const aid of outermostFirst) {
    const a = scene.get(aid);
    if (a?.kind !== 'container' || !a.copiesFromPose) continue;
    const copies = a.copiesFromPose(poseOf(a), a) ?? [];
    if (copies.length === 0) continue;
    // A copy at an outer level carries everything inside it, inner copies included.
    all = all.flatMap((m) => [m, ...copies.map((c) => multiply(m, c))]);
  }
  return all.slice(1);
}
