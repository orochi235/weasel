/** What a scene-backed pick reads per node, shared by `scenePickSource` and the
 *  pick index so the two cannot disagree about a node's ancestors or path. */
import type { Path } from '@weasel-js/geom';
import { asNodeId, type Node, type Scene } from 'core/scene/types';
import { sceneDerivedPathOf, showsComputedPath } from './derivedPath';
import type { PickCandidate } from './pickWalk';

/** Shared, never mutated: most scenes are flat and every node returns it. */
const EMPTY_PARENTS: readonly never[] = [];

/** `(node) => its ancestors, innermost first`, stopping at a cycle or a missing parent. */
export function sceneParentsOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): (node: PickCandidate<TPose>) => readonly PickCandidate<TPose>[] {
  return (node) => {
    let parentId = (node as { parent?: string | null }).parent ?? null;
    if (parentId === null) return EMPTY_PARENTS;
    const chain: PickCandidate<TPose>[] = [];
    const seen = new Set<string>();
    while (parentId !== null) {
      if (seen.has(parentId)) break;
      seen.add(parentId);
      const parent = scene.get(asNodeId(parentId));
      if (!parent) break;
      chain.push(parent as unknown as PickCandidate<TPose>);
      parentId = parent.parent ?? null;
    }
    return chain;
  };
}

/** `(node) => the path it shows in place of its pose`, or null: an override's
 *  path or the one it derives, at the poses the scene paints its dependencies. */
export function sceneShownPathOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): (node: PickCandidate<TPose>) => Path | null {
  const derived = sceneDerivedPathOf(scene);
  return (node) => {
    const n = node as unknown as Node<TData, TLayer, TPose>;
    return showsComputedPath(scene, n) ? derived(n) : null;
  };
}
