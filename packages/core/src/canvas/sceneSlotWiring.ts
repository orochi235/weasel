/**
 * What the scene slot needs from the `Scene` that `<Canvas>` cannot see.
 *
 * `<Canvas>` is scene-agnostic: it walks an adapter. Two things a node carries
 * are therefore invisible to it — an ephemeral override's alpha, and a derived
 * path, which needs other nodes' poses to resolve. `<SceneCanvas>` folds both
 * into the slot here; `buildSceneViewCommands` does the same for the headless
 * walk.
 */
import type { SceneSlotConfig } from './Canvas';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { withDerivedPaths, resolveDerivedPath, scenePoseLookup } from './derivedPath';

/**
 * The alpha a view paints a node at: the view's own `alphaFor` times any
 * ephemeral override alpha.
 *
 * The hit path asks this too — a node painted at alpha 0 is not on screen and
 * must not claim clicks — so it is one function rather than the painter's and
 * picking's separate readings of the same two inputs.
 */
export function composeAlphaFor<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  alphaFor?: (id: string) => number,
): (id: string) => number {
  const overrideAlphaFor = (id: string) => scene.overrides.get(id as NodeId)?.alpha ?? 1;
  return alphaFor ? (id: string) => alphaFor(id) * overrideAlphaFor(id) : overrideAlphaFor;
}

export function wireSceneSlotToScene<TData, TLayer extends string, TPose>(
  slot: SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
  scene: Scene<TData, TLayer, TPose>,
  alphaFor?: (id: string) => number,
): SceneSlotConfig<Node<TData, TLayer, TPose>, TPose> {
  const poseOf = scenePoseLookup(scene);
  return {
    ...slot,
    drawOne: withDerivedPaths(scene, slot.drawOne),
    derivedPathOf: (node) => resolveDerivedPath(node, poseOf),
    alphaFor: composeAlphaFor(scene, alphaFor),
  };
}
