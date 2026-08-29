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
import { withDerivedPaths } from './derivedPath';

export function wireSceneSlotToScene<TData, TLayer extends string, TPose>(
  slot: SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
  scene: Scene<TData, TLayer, TPose>,
  alphaFor?: (id: string) => number,
): SceneSlotConfig<Node<TData, TLayer, TPose>, TPose> {
  const overrideAlphaFor = (id: string) => scene.overrides.get(id as NodeId)?.alpha ?? 1;
  return {
    ...slot,
    drawOne: withDerivedPaths(scene, slot.drawOne),
    alphaFor: alphaFor
      ? (id: string) => alphaFor(id) * overrideAlphaFor(id)
      : overrideAlphaFor,
  };
}
