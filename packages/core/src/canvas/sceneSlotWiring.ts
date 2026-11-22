/**
 * What the scene slot needs from the `Scene` that `<Canvas>` cannot see.
 *
 * `<Canvas>` is scene-agnostic: it walks an adapter. Five things a node is
 * painted with are therefore invisible to it — an ephemeral override's alpha
 * and data, a derived path, which needs other nodes' poses to resolve, the
 * paint an `'inherit'` field takes from its containers, and animated vertex
 * colors and stroke trims, which live in an animator. `<SceneCanvas>` folds them into the slot
 * here; `buildSceneViewCommands` does the same for the headless walk.
 */
import type { SceneSlotConfig, WiredSceneSlot } from './buildSceneLayer';
import { sceneSubtreeCull } from './reach/sceneVisibility';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { withInheritedPaintBounds, withInheritedPaints } from './inheritedPaints';
import { withSceneShapes } from './sceneShapes';
import { nodeShapesOf } from './nodeShapeRegistry';
import { withDerivedPaths, withOverridePathBounds, sceneDerivedPathOf, sceneShownToPose } from './derivedPath';
import type { PaintBoundsFn } from './paintCull';
import { withPaintOverrides, type PaintOverrides } from './paintOverrides';
import { nodeAsShown, shownLookup } from 'core/scene/nodeAsShown';
import { withShownNode } from './shownNodes';
import { drawnPoseOf } from 'core/scene/outputGrid';
import type { LodState } from './lod/lodState';

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

/**
 * A cull's `paintBounds` measuring a node as the scene shows it: its override data, a pose
 * override's `path`, the shapes the scene registers and the paint it inherits. `<SceneCanvas>`'s
 * slot and the headless scene view both cull through this, so the two agree on what is off screen.
 */
export function sceneCullPaintBounds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  paintBounds: PaintBoundsFn<Node<TData, TLayer, TPose>, TPose>,
  shown = shownLookup(scene),
  toPose?: (node: Node<TData, TLayer, TPose>) => TPose,
): PaintBoundsFn<Node<TData, TLayer, TPose>, TPose> {
  return withShownNode(scene.overrides, withSceneShapes(scene, withOverridePathBounds(scene, withInheritedPaintBounds(shown, paintBounds), toPose)));
}

export function wireSceneSlotToScene<TData, TLayer extends string, TPose>(
  slot: SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
  scene: Scene<TData, TLayer, TPose>,
  alphaFor?: (id: string) => number,
  overrides?: PaintOverrides,
  /** What the view drew each node as last frame, for hysteresis and its picking. */
  lodState?: LodState,
): WiredSceneSlot<Node<TData, TLayer, TPose>, TPose> {
  const shown = shownLookup(scene);
  const derived = withDerivedPaths(scene, withSceneShapes(scene, withInheritedPaints(shown, slot.drawOne)), slot.toPose);
  const painted = withPaintOverrides(overrides, derived);
  const derivedPathOf = sceneDerivedPathOf(scene, slot.toPose);
  const drawnAt = drawnPoseOf(scene);
  return {
    ...slot,
    ...(slot.toPose ? { toPose: sceneShownToPose(scene, slot.toPose) } : {}),
    ...(slot.paintBounds
      ? {
          paintBounds: sceneCullPaintBounds(scene, slot.paintBounds, shown, slot.toPose),
          subtreeCull: (rect) => sceneSubtreeCull(scene, slot.paintBounds!, rect, slot.toPose),
        }
      : {}),
    drawOne: withShownNode(scene.overrides, painted),
    ...(drawnAt ? { drawnPose: (node: Node<TData, TLayer, TPose>, pose: TPose) => drawnAt(nodeAsShown(scene.overrides, node), pose) } : {}),
    derivedPathOf: (node) => derivedPathOf(nodeAsShown(scene.overrides, node)),
    alphaFor: composeAlphaFor(scene, alphaFor),
    shapes: nodeShapesOf(scene),
    ...(lodState ? { lodState } : {}),
  };
}
