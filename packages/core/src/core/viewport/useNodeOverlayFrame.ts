/**
 * `useNodeOverlayFrame` — the coordinate frame a DOM overlay pinned to one
 * scene node needs: the node's world box, the projection from that box's
 * frame into overlay pixels, and the overlay's measured size.
 *
 * `toScreen` maps the node's **unrotated world box** frame, which is the
 * frame `paintToLocalUnits` resolves a `units: 'bounds'` paint into and the
 * one `pathInPoseBox` projects geometry into. The pose's rotation and
 * `transform` live in this hook, not in those: a node's stored geometry is
 * in its box by definition.
 */
import { useCallback, useInsertionEffect, useRef, type RefObject } from 'react';
import {
  transformPoint, invert, poseFrameOf, viewScreenToWorld, viewWorldToScreen, type Affine, type Rect,
} from '@weasel-js/geom';
import type { Node, RectPose, Scene } from '../scene/types';
import { useCanvasSize } from './useCanvasSize';
import type { View } from './view';
import { composeRectPose, composeWorldPose } from 'core/scene/composePose';
import { effectivePose } from 'core/scene/effectivePose';

/** Structural point, matching every other `{ x, y }` the kit passes across a
 *  boundary. */
export interface OverlayPoint {
  x: number;
  y: number;
}

/** The overlay frame for one node. `null` from the hook means there is no
 *  frame yet — no node, or nothing measured to draw it on. */
export interface NodeOverlayFrame {
  /** The node's composed world box, **unrotated**: the frame `toScreen` maps
   *  from, and the box to hand `paintToLocalUnits` / `paintToBoundsUnits`. */
  box: Rect;
  /** Node box frame → overlay pixels: the pose's rotation and `transform`,
   *  then the view. While the node is gone or a live view flattens an axis, it
   *  and `toLocal` keep the last mapping that had an inverse. */
  toScreen: (p: OverlayPoint) => OverlayPoint;
  /** Overlay pixels → node box frame. Inverts `toScreen`. */
  toLocal: (p: OverlayPoint) => OverlayPoint;
  /** The container's size in CSS pixels — the overlay's own box. */
  width: number;
  height: number;
}

/** Options for `useNodeOverlayFrame`. */
export interface UseNodeOverlayFrameOptions<TPose> {
  /**
   * Current viewport. A thunk is re-read on every projection, which is what
   * an uncontrolled `SceneCanvas` needs — its camera moves without a render,
   * so pass the handle's `getView`. Omit it and world units are handed
   * through as screen pixels.
   */
  view?: View | (() => View);
  /** Fold a child pose into its parent's frame. Default `composeRectPose`. */
  compose?: (parent: TPose, child: TPose) => TPose;
}

/**
 * Resolve the overlay frame for `nodeId` against `containerRef` — the element
 * the overlay is positioned in, which must be the canvas's own box for the
 * projection to land.
 *
 * Returns `null` when there is no node under `nodeId`, when the container has
 * not been measured, or when the view or the pose's `transform` collapses an
 * axis to zero.
 */
export function useNodeOverlayFrame<TData, TLayer extends string, TPose extends RectPose>(
  scene: Scene<TData, TLayer, TPose>,
  containerRef: RefObject<HTMLElement | null>,
  nodeId: string | null | undefined,
  options: UseNodeOverlayFrameOptions<TPose> = {},
): NodeOverlayFrame | null {
  const { width, height } = useCanvasSize(containerRef);
  const { view, compose } = options;

  const project = useCallback((): Projection | null => {
    const box = worldBoxOf(scene, nodeId, compose);
    return box ? projectionOf(poseFrameOf(box), resolveView(view)) : null;
  }, [scene, nodeId, compose, view]);

  const lastInvertible = useRef<Projection | null>(null);

  /** The live mapping, or while there is none that inverts, the last one that did. */
  const mapping = useCallback((): Projection => {
    const m = project();
    if (m?.invertible) lastInvertible.current = m;
    // Published by the commit that handed out toScreen and toLocal, so there is one.
    return m?.invertible ? m : lastInvertible.current!;
  }, [project]);

  const toScreen = useCallback((p: OverlayPoint): OverlayPoint => forward(mapping(), p), [mapping]);
  const toLocal = useCallback((p: OverlayPoint): OverlayPoint => backward(mapping(), p), [mapping]);

  const box = worldBoxOf(scene, nodeId, compose);
  const m = box && width !== 0 && height !== 0 ? project() : null;
  const invertible = m?.invertible ? m : null;
  useInsertionEffect(() => {
    if (invertible) lastInvertible.current = invertible;
  });

  if (!box || !invertible) return null;
  return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, toScreen, toLocal, width, height };
}

function resolveView(view: View | (() => View) | undefined): View | undefined {
  return typeof view === 'function' ? view() : view;
}

function worldBoxOf<TData, TLayer extends string, TPose extends RectPose>(
  scene: Scene<TData, TLayer, TPose>,
  nodeId: string | null | undefined,
  compose: ((parent: TPose, child: TPose) => TPose) | undefined,
): TPose | null {
  if (nodeId == null) return null;
  const nodes = scene.nodes as ReadonlyMap<string, Node<TData, TLayer, TPose>>;
  if (!nodes.has(nodeId)) return null;
  // `effectivePose`, not `node.pose`: an overlay tracks what the renderer
  // draws, and a gesture override or a derived pose is exactly the difference.
  const adapter = {
    getPose: (id: string) => effectivePose(scene, nodes.get(id)!),
    getParent: (id: string) => nodes.get(id)?.parent ?? null,
  };
  return composeWorldPose(adapter, nodeId, compose ?? composeRectPose);
}

/** Node box frame → world (`frame`, `null` for none), then world → overlay pixels as
 *  `(world − view) × view.scale`. Kept as two steps: one matrix would add two values the
 *  size of `world × scale` and lose whole pixels far from the origin. */
interface Projection {
  frame: Affine | null;
  view: View | undefined;
  frameInverse: Affine | null;
  /** Whether `toLocal` can undo it: neither the frame nor the view flattens an axis. */
  invertible: boolean;
}

function projectionOf(frame: Affine | null, view: View | undefined): Projection {
  const frameInverse = frame && invert(frame);
  const viewInvertible = !view || (view.scale.x !== 0 && view.scale.y !== 0
    && Number.isFinite(1 / view.scale.x) && Number.isFinite(1 / view.scale.y));
  return { frame, view, frameInverse, invertible: viewInvertible && (!frame || frameInverse !== null) };
}

function forward(m: Projection, p: OverlayPoint): OverlayPoint {
  const [x, y] = m.frame ? transformPoint(m.frame, p.x, p.y) : [p.x, p.y];
  return m.view ? viewWorldToScreen(m.view, { x, y }) : { x, y };
}

function backward(m: Projection, p: OverlayPoint): OverlayPoint {
  const w = m.view ? viewScreenToWorld(m.view, p) : p;
  if (!m.frameInverse) return { x: w.x, y: w.y };
  const [x, y] = transformPoint(m.frameInverse, w.x, w.y);
  return { x, y };
}
