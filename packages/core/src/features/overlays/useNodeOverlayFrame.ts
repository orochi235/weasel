/**
 * `useNodeOverlayFrame` — the coordinate frame a DOM overlay pinned to one
 * scene node needs: the node's world box, the projection from that box's
 * frame into overlay pixels, and the overlay's measured size.
 *
 * This is the frame half of `subscribeView`'s "DOM pinned to world
 * coordinates" case. Consumers positioning chrome over a node — gradient
 * handles, a badge, a caret — otherwise re-derive it, and the
 * translate-and-scale inverse that derivation usually reaches for drops
 * `pose.rotation`, so the chrome sits where the node would be unrotated.
 *
 * `toScreen` maps the node's **unrotated world box** frame, which is the
 * frame `fillInPoseFrame` resolves a `units: 'bounds'` paint into and the
 * one `pathInPoseFrame` projects geometry into. Rotation lives in this hook,
 * not in those: a node's stored geometry is pre-rotation by definition.
 */
import { useCallback, type RefObject } from 'react';
import { applyToPoint, invert, multiply, type Mat3 } from '@weasel-js/geom';
import type { Node, RectPose, Scene } from '../../core/scene/types';
import { useCanvasSize } from '../../core/viewport/useCanvasSize';
import type { View } from '../../core/viewport/view';
import { composeRectPose, composeWorldPose } from '../groups/composePose';
import { poseRotationOf } from '../paths/poseRotation';

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
   *  from, and the box to hand `fillInPoseFrame` / `fillToBoundsFrame`. */
  box: { x: number; y: number; width: number; height: number };
  /** Node box frame → overlay pixels, rotation and view included. */
  toScreen: (p: OverlayPoint) => OverlayPoint;
  /** Overlay pixels → node box frame. Inverts `toScreen`. */
  toLocal: (p: OverlayPoint) => OverlayPoint;
  /** The container's size in CSS pixels — the overlay's own box. */
  width: number;
  height: number;
}

export interface UseNodeOverlayFrameOptions<TPose> {
  /**
   * Current viewport. A thunk is re-read on every projection, which is what
   * an uncontrolled `SceneCanvas` needs — its camera lives in a ref and moves
   * without a render, so pass the handle's `getView`. A plain `View` is the
   * value from the render that supplied it, correct for a controlled
   * consumer. Omit it and world units are handed through as screen pixels.
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
 * not been measured, or when the view collapses an axis to zero — the three
 * states in which an overlay has nothing to draw.
 */
export function useNodeOverlayFrame<TData, TLayer extends string, TPose extends RectPose>(
  scene: Scene<TData, TLayer, TPose>,
  containerRef: RefObject<HTMLElement | null>,
  nodeId: string | null | undefined,
  options: UseNodeOverlayFrameOptions<TPose> = {},
): NodeOverlayFrame | null {
  const { width, height } = useCanvasSize(containerRef);
  const { view, compose } = options;

  const project = useCallback((): Mat3 | null => {
    const box = worldBoxOf(scene, nodeId, compose);
    if (!box) return null;
    return multiply(viewMatrix(resolveView(view)), rotationMatrix(box));
  }, [scene, nodeId, compose, view]);

  const toScreen = useCallback((p: OverlayPoint): OverlayPoint => {
    const m = project();
    if (!m) return p;
    const [x, y] = applyToPoint(m, p.x, p.y);
    return { x, y };
  }, [project]);

  const toLocal = useCallback((p: OverlayPoint): OverlayPoint => {
    const m = project();
    const inverse = m ? invert(m) : null;
    if (!inverse) return p;
    const [x, y] = applyToPoint(inverse, p.x, p.y);
    return { x, y };
  }, [project]);

  const box = worldBoxOf(scene, nodeId, compose);
  if (!box || width === 0 || height === 0) return null;
  const m = project();
  if (!m || !invert(m)) return null;

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
  const adapter = {
    getPose: (id: string) => nodes.get(id)!.pose,
    getParent: (id: string) => nodes.get(id)?.parent ?? null,
  };
  return composeWorldPose(adapter, nodeId, compose ?? composeRectPose);
}

/** World → overlay pixels: `screen = (world − view) × view.scale`. */
function viewMatrix(view: View | undefined): Mat3 {
  if (!view) return [1, 0, 0, 1, 0, 0];
  const { x: sx, y: sy } = view.scale;
  return [sx, 0, 0, sy, -view.x * sx, -view.y * sy];
}

/** The pose→world leg the box frame omits, per `poseRotationOf`'s convention. */
function rotationMatrix(pose: RectPose): Mat3 {
  const r = poseRotationOf(pose);
  if (!r) return [1, 0, 0, 1, 0, 0];
  const c = Math.cos(r.rotation);
  const s = Math.sin(r.rotation);
  return [c, s, -s, c, r.cx - r.cx * c + r.cy * s, r.cy - r.cx * s - r.cy * c];
}
