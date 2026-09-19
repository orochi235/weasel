/**
 * The render walk's half of derived paths: resolving one against a scene, and
 * handing it to the painter.
 *
 * The resolver itself lives in `core/scene/derivedPath.ts`, beside
 * `derivedPose` — a *pose* can derive from a dependency's path, so
 * `effectivePose` has to be able to reach it.
 */
import type { DerivedDep, Node, NodeId, Scene } from 'core/scene/types';
import type { Path } from 'core/geometry/path';
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
 * the nodes it connects. A slot's `toPose` replaces that read, so `toPose`
 * replaces it here too.
 */
export function sceneDepLookup<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): (id: NodeId) => DerivedDep<TPose> | undefined {
  if (toPose === undefined) return (id) => derivedDepOf(scene, id);
  const slot = memoSlotFor(toPose);
  const childrenOf = (id: NodeId): readonly NodeId[] => scene.childrenOf(id);
  const lookup = (id: NodeId): DerivedDep<TPose> | undefined => {
    const node = scene.get(id);
    if (node === undefined) return undefined;
    return {
      node: node as unknown as Node<unknown, string, TPose>,
      pose: toPose(node),
      get path(): Path | null {
        return resolveDerivedPath(node, lookup, childrenOf, slot);
      },
    };
  };
  return lookup;
}

/** `(node) => the path it derives`, read through {@link sceneDepLookup}. */
export function sceneDerivedPathOf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): (node: Node<TData, TLayer, TPose>) => Path | null {
  const depOf = sceneDepLookup(scene, toPose);
  const slot = toPose === undefined ? undefined : memoSlotFor(toPose);
  const childrenOf = (id: NodeId): readonly NodeId[] => scene.childrenOf(id);
  return (node) => resolveDerivedPath(node, depOf, childrenOf, slot);
}

const toPoseSlots = new WeakMap<object, string>();
let nextToPoseSlot = 0;

/** One memo slot per `toPose`: two slots painting one scene at different
 *  poses must not serve each other's paths. */
function memoSlotFor(toPose: object): string {
  let slot = toPoseSlots.get(toPose);
  if (slot === undefined) {
    slot = `kit:derivedPath:toPose:${nextToPoseSlot++}`;
    toPoseSlots.set(toPose, slot);
  }
  return slot;
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
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const derivedPathOf = sceneDerivedPathOf(scene, toPose);
  return (node, pose, view, ctx) => {
    if (node.dependsOn === undefined) return drawOne(node, pose, view, ctx);
    return drawOne(node, pose, view, { ...ctx, derivedPath: derivedPathOf(node) });
  };
}
