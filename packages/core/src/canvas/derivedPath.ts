/**
 * Derived geometry, resolved for the two scene-aware walks.
 *
 * The memo slot is keyed on the node's own pose — the slot
 * `dropPoseKeyedMemoSlots` clears — because the scene *pushes* invalidation
 * when a dependency's world pose changes. Nothing here compares dependency
 * poses: a pose override mutates its buffer in place, so no reference
 * comparison could see it.
 */
import type { Node, NodeId, Scene } from 'core/scene/types';
import type { Path } from 'core/geometry/path';
import { nodeMemo } from 'core/scene/nodeMemo';
import { IDENTITY_POSE_COMPOSITION, worldPoseLookup } from 'features/groups/composePose';
import type { SceneViewDrawOne } from './sceneViewRender';

const SLOT = 'kit:derivedPath';

/**
 * The path `node` computes from its dependencies' poses, or `null` when it
 * derives from nothing (the normal case) or its `derive` has nothing to draw.
 *
 * `poseOf` supplies each dependency's **effective world** pose; a dependency
 * it cannot resolve reaches `derive` as `undefined`.
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
 * `(id) => effective world pose` over a scene: an ephemeral override wins over
 * the document pose, and the parent chain is folded in.
 *
 * The fold is IDENTITY, matching the render walk — `buildSceneTree` paints the
 * pose the scene stores. A scene whose poses are parent-relative composes them
 * nowhere in the render path either, so composing them here would hand `derive`
 * coordinates that disagree with the dependencies as painted.
 */
export function scenePoseLookup<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
): (id: NodeId) => TPose | undefined {
  const lookup = worldPoseLookup<TPose>(
    {
      getPose: (id) => {
        const node = scene.get(id as NodeId);
        // Thrown, not returned: `worldPoseLookup` maps a throw to `null`.
        if (node === undefined) throw new Error(`scenePoseLookup: unknown node "${id}"`);
        return scene.overrides.get(id as NodeId)?.pose ?? node.pose;
      },
      getParent: (id) => scene.get(id as NodeId)?.parent ?? null,
    },
    IDENTITY_POSE_COMPOSITION.compose as (parent: TPose, child: TPose) => TPose,
  );
  return (id) => lookup(id) ?? undefined;
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
