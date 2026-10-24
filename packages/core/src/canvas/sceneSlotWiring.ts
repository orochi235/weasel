/**
 * What the scene slot needs from the `Scene` that `<Canvas>` cannot see.
 *
 * `<Canvas>` is scene-agnostic: it walks an adapter. Five things a node is
 * painted with are therefore invisible to it — an ephemeral override's alpha
 * and data, a derived path, which needs other nodes' poses to resolve, the
 * paint an `'inherit'` field takes from its containers, and animated vertex
 * colors, which live in an animator. `<SceneCanvas>` folds them into the slot
 * here; `buildSceneViewCommands` does the same for the headless walk.
 */
import type { SceneSlotConfig } from './buildSceneLayer';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { withInheritedPaintBounds, withInheritedPaints } from './inheritedPaints';
import { withDerivedPaths, sceneDerivedPathOf, sceneShownToPose } from './derivedPath';
import { withColorOverrides } from './colorOverrides';
import { nodeAsShown, shownLookup } from 'core/scene/nodeAsShown';
import { withShownNode } from './shownNodes';
import type { ColorOverrideRegistry } from '@weasel-js/animator';

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
  const overrideAlphaFor = (id: string) => scene.overrides.read(id as NodeId)?.alpha ?? 1;
  return alphaFor ? (id: string) => alphaFor(id) * overrideAlphaFor(id) : overrideAlphaFor;
}

export function wireSceneSlotToScene<TData, TLayer extends string, TPose>(
  slot: SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
  scene: Scene<TData, TLayer, TPose>,
  alphaFor?: (id: string) => number,
  colorOverrides?: ColorOverrideRegistry,
): SceneSlotConfig<Node<TData, TLayer, TPose>, TPose> {
  const shown = shownLookup(scene);
  const derived = withDerivedPaths(scene, withInheritedPaints(shown, slot.drawOne), slot.toPose);
  const painted = colorOverrides ? withColorOverrides(colorOverrides, derived) : derived;
  const derivedPathOf = sceneDerivedPathOf(scene, slot.toPose);
  return {
    ...slot,
    ...(slot.toPose ? { toPose: sceneShownToPose(scene, slot.toPose) } : {}),
    ...(slot.paintBounds
      ? { paintBounds: withShownNode(scene.overrides, withInheritedPaintBounds(shown, slot.paintBounds)) }
      : {}),
    drawOne: withShownNode(scene.overrides, painted),
    derivedPathOf: (node) => derivedPathOf(nodeAsShown(scene.overrides, node)),
    alphaFor: composeAlphaFor(scene, alphaFor),
  };
}
