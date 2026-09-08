/**
 * Invalidation here is *pushed* by the scene, never pulled: a pose override
 * mutates its buffer in place, so no comparison this module could make would
 * see a dependency move. The memo is keyed on the node's own pose because that
 * is the slot `dropPoseKeyedMemoSlots` clears.
 */
import type { DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import type { Path } from 'core/geometry/path';
import { dependencyIdsOf } from 'core/scene/dependents';
import { effectivePose } from 'core/scene/effectivePose';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { SceneViewDrawOne } from './NodeShape';

const SLOT = 'kit:derivedPath';

/**
 * The path `node` computes from its dependencies' poses, or `null` when it
 * derives from nothing (the normal case) or its `derivePath` has nothing to draw.
 *
 * `depOf` supplies each dependency — its node and the pose it is painted at;
 * one it cannot resolve reaches `derivePath` as `undefined`. `childrenOf`
 * answers a node whose `dependsOn` is `'children'`.
 */
export function resolveDerivedPath<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  depOf: (id: NodeId) => DerivedDep<TPose> | undefined,
  childrenOf: (id: NodeId) => readonly NodeId[],
): Path | null {
  const derivePath = node.derivePath;
  if (derivePath === undefined) return null;
  const ids = dependencyIdsOf(node, childrenOf);
  if (ids.length === 0) return null;
  return nodeMemo(node, SLOT, node.pose, () =>
    derivePath(node as Node<unknown, string, TPose>, ids.map((id) => depOf(id))),
  );
}

/**
 * `(id) => that node and the pose it is painted at` — {@link effectivePose}
 * against the scene, so a dependency that is itself derived resolves before it
 * is read.
 *
 * `Scene` stores absolute poses and the render walks hand `getPose` straight to
 * `drawOne`, composing nothing, so this has to read exactly what the render
 * adapters read: a derived edge is drawn from these coordinates and must meet
 * the nodes it connects.
 */
export function sceneDepLookup<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): (id: NodeId) => DerivedDep<TPose> | undefined {
  return (id) => {
    const node = scene.get(id);
    if (node === undefined) return undefined;
    return { node: node as Node<unknown, string, TPose>, pose: effectivePose(scene, node) };
  };
}

/**
 * Wrap a `drawOne` so a node that derives its geometry arrives at the painter
 * with the resolved path. The painter has no scene handle and so cannot read
 * the dependencies' poses itself; both scene walks wrap here instead.
 *
 * A node that derives nothing passes the caller's `ctx` through untouched —
 * this runs per node per frame, and an added `{ derivedPath: null }` would be
 * an allocation per node for a field no painter reads.
 */
export function withDerivedPaths<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const depOf = sceneDepLookup(scene);
  const childrenOf = (id: NodeId): readonly NodeId[] => scene.childrenOf(id);
  return (node, pose, view, ctx) => {
    if (node.dependsOn === undefined) return drawOne(node, pose, view, ctx);
    return drawOne(node, pose, view, {
      ...ctx,
      derivedPath: resolveDerivedPath(node, depOf, childrenOf),
    });
  };
}
