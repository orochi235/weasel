/**
 * Invalidation here is *pushed* by the scene, never pulled: a pose override
 * mutates its buffer in place, so no comparison this module could make would
 * see a dependency move. The memo is keyed on the node's own pose because that
 * is the slot `dropPoseKeyedMemoSlots` clears.
 */
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Path } from 'core/geometry/path';
import { nodeMemo } from 'core/scene/nodeMemo';
import type { SceneViewDrawOne } from './sceneViewRender';

const SLOT = 'kit:derivedPath';

/**
 * The path `node` computes from its dependencies' poses, or `null` when it
 * derives from nothing (the normal case) or its `derive` has nothing to draw.
 *
 * `poseOf` supplies each dependency's painted pose; one it cannot resolve
 * reaches `derive` as `undefined`.
 */
export function resolveDerivedPath<TData, TLayer extends string, TPose>(
  node: Node<TData, TLayer, TPose>,
  poseOf: (id: NodeId) => TPose | undefined,
): Path | null {
  const deps = node.dependsOn;
  const derive = node.derive;
  if (deps === undefined || deps.length === 0 || derive === undefined) return null;
  return nodeMemo(node, SLOT, node.pose, () =>
    derive(node as Node<unknown, string, TPose>, deps.map((id) => poseOf(id))),
  );
}

/**
 * `(id) => the pose that node is painted at` — its ephemeral override when it
 * has one, else the pose the scene stores.
 *
 * `Scene` stores absolute poses and the render walks hand `getPose` straight to
 * `drawOne`, composing nothing, so this has to read exactly what the render
 * adapters read: a derived edge is drawn from these coordinates and must meet
 * the nodes it connects.
 */
export function scenePoseLookup<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): (id: NodeId) => TPose | undefined {
  return (id) => {
    const node = scene.get(id);
    if (node === undefined) return undefined;
    return scene.overrides.get(id)?.pose ?? node.pose;
  };
}

/**
 * Wrap a `drawOne` so every node it paints arrives with its derived path.
 *
 * Both scene walks wrap here rather than deriving inside the painter, which
 * has no scene handle and so cannot read the dependencies' poses.
 */
export function withDerivedPaths<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const poseOf = scenePoseLookup(scene);
  return (node, pose, view) =>
    drawOne(node, pose, view, { derivedPath: resolveDerivedPath(node, poseOf) });
}
