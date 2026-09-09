/**
 * The render walk's half of derived paths: resolving one against a scene, and
 * handing it to the painter.
 *
 * The resolver itself lives in `core/scene/derivedPath.ts`, beside
 * `derivedPose` — a *pose* can derive from a dependency's path, so
 * `effectivePose` has to be able to reach it.
 */
import type { DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import { derivedDepOf } from 'core/scene/effectivePose';
import { resolveDerivedPath } from 'core/scene/derivedPath';
import type { SceneViewDrawOne } from './NodeShape';

export { resolveDerivedPath } from 'core/scene/derivedPath';

/**
 * `(id) => that node, the pose it is painted at, and the path it derives` —
 * resolved against the scene, so a dependency that is itself derived resolves
 * before it is read.
 *
 * `Scene` stores absolute poses and the render walks hand `getPose` straight to
 * `drawOne`, composing nothing, so this has to read exactly what the render
 * adapters read: a derived edge is drawn from these coordinates and must meet
 * the nodes it connects.
 */
export function sceneDepLookup<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): (id: NodeId) => DerivedDep<TPose> | undefined {
  return (id) => derivedDepOf(scene, id);
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
      derivedPath: resolveDerivedPath(
        node as Node<TData, TLayer, TPose>,
        depOf,
        childrenOf,
      ),
    });
  };
}
