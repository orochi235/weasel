/**
 * Scene-aware select-tool synthesis for `<SceneCanvas>`: a `useSelectTool`
 * over the caller's scene adapter, configured with kit-default pickEvery /
 * boundsOf derived from pose shape. Caller-supplied `pickEvery` / `boundsOf`
 * overrides via the `geometry` arg take precedence.
 */
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import type { SceneCanvasAdapter } from '../sceneAdapter';
import { pickWalk, scenePickSource, scenePlaneOf, type PickQuery, type ViewPickGates } from 'canvas/pickWalk';
import { rectFromPlane, toPlane, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { pathContainsPoint } from '@weasel-js/geom';
import { useSelectTool, type Bounds } from 'tools/builtin/select';
import { pickTopMostHit, type PickTopMostHitAdapter } from 'tools/builtin/pickTopMostHit';
import type { Node, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type { SnapStrategy } from 'interactions/gestures/types';
import { snap as snapBehavior } from 'interactions/gestures/shared/snap';
import { poseDescriptorForNode, type PoseDescriptor } from 'interactions/actions/resize/geometry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { poseContains, poseContainsRotated } from './poseGeometry';
import { shapeCoversPoint, findShapeInk } from 'canvas/NodeShape';
import { meanScale } from 'core/viewport/meanScale';

/**
 * Default grab slop around a shape's outline, in screen pixels.
 *
 * Four is the same number the path-pose stroke test has always used, and it's
 * the difference between a hairline being clickable and not: a 1px stroke is
 * half a world unit of reach at scale 1, which no pointing device can hit
 * reliably. It also lets a filled shape be grabbed a few pixels outside its
 * edge, which is what makes edge-adjacent dragging feel possible.
 */
export const DEFAULT_PICK_TOLERANCE_PX = 4;

/** The view a pick is asked for. A world point carries neither the scale it
 *  was produced under nor what that view paints, so a caller picking for a
 *  view other than the surface's says both. A gate left out is the one this
 *  hook was built with. */
export interface PickView extends ViewPickGates {
  scale: { x: number; y: number };
  /** The rest of the asking camera. Supplied, it lets a parallax layer be
   *  picked through its plane; left out, every layer is taken to move with
   *  the camera. */
  x?: number;
  y?: number;
}

/** A pick view that names a whole camera, or null. */
function cameraOf(v: Pick<PickView, 'scale' | 'x' | 'y'> | null): View | null {
  return v && typeof v.x === 'number' && typeof v.y === 'number'
    ? { x: v.x, y: v.y, scale: v.scale }
    : null;
}

export interface UseSceneSelectToolArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  /** The adapter the select tool drives, built over `scene` with the same
   *  `poseDescriptor`. Its world poses are what picking and bounds read. */
  adapter: SceneCanvasAdapter<TData, TLayer, TPose>;
  /** How to read and rewrite this scene's poses. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  geometry?: {
    pickEvery?: (worldX: number, worldY: number) => string | string[] | null;
    boundsOf?: (id: string) => Bounds | null;
    /** How the default body-pick decides a node covers the pointer. Defaults
     *  to `'shape'`; `'pose'` opts back down to the bare pose rect. See
     *  `SceneCanvasProps.geometry.picking`. Ignored when `pickEvery` is
     *  supplied — that override owns the whole test. */
    picking?: 'pose' | 'shape';
    /** Grab slop around a shape's outline, in screen pixels. See
     *  `SceneCanvasProps.geometry.pickTolerancePx`. */
    pickTolerancePx?: number;
  };
  /** The surface's camera, for converting the screen-pixel pick tolerance into
   *  world units. A caller picking for another view passes that view's camera
   *  to `pickEvery` / `pickBest` instead. Omitted in tests and non-viewport
   *  hosts, where scale is 1. */
  getView?: () => Pick<PickView, 'scale' | 'x' | 'y'> | null;
  /** The asking view's painted alpha per node — its `alphaFor` times any
   *  per-node override alpha. A node the view paints at alpha 0 is not on
   *  screen, so picking must not answer for it. */
  alphaOf?: (id: string) => number;
  /** The asking view's answer to "does this scene layer reach the screen".
   *  `layerVisibility` and `layerOrder` both gate a layer out of the paint
   *  (`drawLayers` drops any layer missing from a supplied order), and an
   *  undrawn layer must not claim clicks. */
  layerIsPainted?: (layer: string) => boolean;
  selectTool?: {
    move?: UseMoveOptions<TPose>;
    resize?: UseResizeOptions<TPose>;
    snap?: SnapStrategy<TPose>;
    /** Override the body-pick used on click/pointerdown. Alt-aware: receives
     *  the live alt state + current selection so consumers can implement
     *  alt-cycling through an overlapping stack. Default: top-most hit
     *  (alt ignored). Forwarded verbatim to `useSelectTool`. */
    pickBest?: (worldX: number, worldY: number, alt: boolean, sel: readonly string[]) => string | null;
    /** Forwarded verbatim to `useSelectTool`. See
     *  `UseSelectToolOptions.extendClickLocked`. */
    extendClickLocked?: () => boolean;
  };
}

export interface UseSceneSelectToolReturn<TData, TLayer extends string, TPose> {
  selectTool: ReturnType<typeof useSelectTool<Node<TData, TLayer, TPose>, TPose>>;
  /** Hit-test resolved with the caller's `geometry.pickEvery` (or the
   *  pose-walk default). Forward this to `<Canvas pickEvery={...}>` so the
   *  dispatcher's `getNodeAtPoint` returns the same node the select tool
   *  picked — drag routes keyed on `target.kind` then resolve to `'*'`
   *  (move) instead of `'empty'` (marquee). */
  pickEvery: (worldX: number, worldY: number, view?: PickView | null) => string[];
  /** Single-best hit under the world point, or null. Runs `pickEvery` then
   *  collapses parent/child overlap via `pickTopMostHit` — matches the id
   *  the select tool's pointerdown classifier would settle on for a bare
   *  click. Exposed so debug HUDs can highlight the would-be selection. */
  pickBest: (worldX: number, worldY: number, view?: PickView | null) => string | null;
  /** World-space AABB of `id`, or null. Same as what the selection overlay +
   *  affordance hit-test need. Exposed so SceneCanvas can pass it to the
   *  `affordanceAt` thunk without re-deriving it. `view` is the camera the
   *  box is drawn under — a plane node sits somewhere else in each — and
   *  defaults to the surface's. */
  boundsOf: (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null) =>
    import('core/viewport/fitViewToBounds').Bounds | null;
  /** How `view`'s world (the surface's camera by default) maps into the plane
   *  `id` is drawn through, or null when its layer moves with the camera. */
  planeOfNode: (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null) => PlaneMap | null;
  /** `boundsOf` for `id` drawn at `pose` rather than its own — how chrome
   *  boxes an in-flight preview. Ignores a `geometry.boundsOf` override, which
   *  answers only for a node's own pose. */
  boundsOfPose: (id: string, pose: TPose, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null) =>
    import('core/viewport/fitViewToBounds').Bounds | null;
  /** `selectTool.move` with `selectTool.snap` folded into its behaviors — what
   *  the `move` preset's bindings carry. */
  moveOptions: UseMoveOptions<TPose>;
}

export function useSceneSelectTool<TData, TLayer extends string, TPose>(
  args: UseSceneSelectToolArgs<TData, TLayer, TPose>,
): UseSceneSelectToolReturn<TData, TLayer, TPose> {
  const { scene, adapter, geometry, selectTool: opts, getView, alphaOf, layerIsPainted } = args;
  const d = (args.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;

  const pickEveryProp = geometry?.pickEvery;
  const boundsOfProp = geometry?.boundsOf;
  // Default. The pose rect is the wrong answer for anything that isn't a
  // rectangle, so `'pose'` is the opt-out rather than the baseline. Cheap to
  // leave on: the rect pre-filter runs first and rejects every node the
  // pointer isn't over, and the survivors' silhouettes are memoized per node.
  const shapePicking = (geometry?.picking ?? 'shape') === 'shape';
  const pickTolerancePx = geometry?.pickTolerancePx ?? DEFAULT_PICK_TOLERANCE_PX;
  const moveOptions = opts?.move;
  const snap = opts?.snap;

  const wiredMoveOptions = useMemo<UseMoveOptions<TPose>>(() => {
    const merged: UseMoveOptions<TPose> = { ...(moveOptions ?? {}) };
    if (snap) {
      const existing = merged.behaviors ?? [];
      merged.behaviors = [snapBehavior(snap), ...existing];
    }
    return merged;
  }, [moveOptions, snap]);

  // Default pickEvery: walk renderOrder() forward (back-to-front) and collect
  // every node whose pose contains the world point. Order matches the
  // `useSelectTool` contract — last element is the topmost — so `pickTopMostHit`
  // picks correctly. Wraps the caller's `pickEvery` (string-or-null) into the
  // array form `useSelectTool` expects. `poseContainsRotated` reads
  // `pose.rotation` directly (the kit's one rotation convention), so rotated
  // shapes pick against their rendered, rotated body without a per-demo override.
  const wiredHitBody = useMemo(() => {
    return (wx: number, wy: number, view?: PickView | null): string[] => {
      if (pickEveryProp) {
        const r = pickEveryProp(wx, wy);
        if (r == null) return [];
        return Array.isArray(r) ? r : [r];
      }
      const asked = view ?? getView?.() ?? null;
      const viewAlpha = view?.alphaOf ?? alphaOf;
      const viewLayers = view?.layerIsPainted ?? layerIsPainted;
      const camera = cameraOf(asked);
      // Through the adapter, not `n.pose`: an ephemeral override is the pose
      // the renderer draws, so it has to be the one picking tests. World, not
      // local, for the same reason — a framed child is drawn in its parent's
      // frame, not where its own pose says.
      const src = scenePickSource<TData, TLayer, TPose>(scene, {
        getPose: (id) => adapter.getWorldPose(id),
        ...(viewAlpha ? { alphaOf: viewAlpha } : {}),
        ...(viewLayers ? { layerIsPainted: viewLayers } : {}),
        ...(camera ? { camera } : {}),
      });
      // `s` makes the slop a screen distance, so the grab zone stays the same
      // apparent thickness at any zoom and on every axis. A stroke's `{px}`
      // width resolves through the mean scale because that is what the
      // renderer paints it at.
      const pointQuery = (px: number, py: number, s: { x: number; y: number }): PickQuery<TPose> => {
        const scale = meanScale(s);
        const tolerance = { px: pickTolerancePx, scale: s };
        return {
          hits: (n, pose, derived) => {
            // The pre-filter has to be at least as generous as the refinement
            // that follows it, or it rejects points the refinement would have
            // claimed. A stroke reaches past the pose box by `outset` — a whole
            // stroke width for an outer align — on top of the pointer slop.
            const outset = shapePicking
              ? (findShapeInk(n as never, pose, { scale })?.outset ?? 0)
              : 0;
            // A derived node's pose is a placeholder — typically zero-sized at
            // the origin — so its own box rejects every point the path covers.
            // The path is the region to test instead, and `poseContains` already
            // reads a path-like pose as one.
            const slop = { ...tolerance, reach: outset };
            const admitted = derived
              ? poseContains(derived as never, px, py, slop, d as PoseDescriptor<unknown>)
              : poseContainsRotated(pose, px, py, slop, d as PoseDescriptor<unknown>);
            if (!admitted) return false;
            // `shapeCoversPoint` narrows the rect to the ink the painter actually
            // lays down (and answers `true` for painters that have no silhouette,
            // so nothing becomes unpickable).
            return !shapePicking
              || shapeCoversPoint(n as never, pose, px, py, {
                tolerance, scale, derivedPath: derived,
              });
          },
          clipAdmits: (clip) => pathContainsPoint(clip, px, py),
          inPlane: (m) => {
            const p = toPlane(m, { x: px, y: py });
            return pointQuery(p.x, p.y, { x: s.x / m.scale.x, y: s.y / m.scale.y });
          },
        };
      };
      return pickWalk<TPose>(src, pointQuery(wx, wy, asked?.scale ?? { x: 1, y: 1 }));
    };
  }, [scene, adapter, pickEveryProp, shapePicking, pickTolerancePx, getView,
      alphaOf, layerIsPainted, d]);

  // Read through a ref: this is the chrome's bounds source, and a caller's
  // inline `getView` would otherwise rebuild it, and everything keyed on it,
  // every render.
  const getViewRef = useLatest(getView);
  const wiredPlaneOfNode = useMemo(() => {
    return (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null): PlaneMap | null => {
      const n = scene.get(asNodeId(id));
      const camera = cameraOf(view ?? getViewRef.current?.() ?? null);
      if (!n || !camera) return null;
      return scenePlaneOf(scene.layers, camera)?.(n.layer) ?? null;
    };
  }, [scene, getViewRef]);

  const wiredBoundsOfPose = useMemo(() => {
    return (id: string, pose: TPose, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null): Bounds | null => {
      const n = scene.get(asNodeId(id));
      if (!n) return null;
      const g = poseDescriptorForNode(d, n);
      const b = g.getBounds(pose);
      const rot = g.getRotation?.(pose) ?? (b as { rotation?: number }).rotation ?? 0;
      const own = rot ? { ...b, rotation: rot } : b;
      // A plane node is drawn where its plane puts it, and the chrome has to
      // follow it there.
      const plane = wiredPlaneOfNode(id, view);
      return plane ? rectFromPlane(plane, own) : own;
    };
  }, [scene, d, wiredPlaneOfNode]);

  const wiredBoundsOf = useMemo(() => {
    return (id: string, view?: Pick<PickView, 'scale' | 'x' | 'y'> | null): Bounds | null => {
      if (boundsOfProp) return boundsOfProp(id);
      if (!scene.get(asNodeId(id))) return null;
      // World, not local: a framed child is drawn in its parent's frame, and
      // the chrome has to land on the ink.
      return wiredBoundsOfPose(id, adapter.getWorldPose(id), view);
    };
  }, [scene, adapter, boundsOfProp, wiredBoundsOfPose]);

  const selectTool = useSelectTool<Node<TData, TLayer, TPose>, TPose>(adapter, {
    pickEvery: wiredHitBody,
    ...(opts?.pickBest ? { pickBest: opts.pickBest } : {}),
    ...(opts?.extendClickLocked ? { extendClickLocked: opts.extendClickLocked } : {}),
  });


  const wiredPickBest = useMemo(() => {
    return (wx: number, wy: number, view?: PickView | null): string | null => {
      const ids = wiredHitBody(wx, wy, view);
      return pickTopMostHit(ids, adapter as unknown as PickTopMostHitAdapter);
    };
  }, [wiredHitBody, adapter]);

  return {
    selectTool,
    pickEvery: wiredHitBody,
    pickBest: wiredPickBest,
    boundsOf: wiredBoundsOf,
    boundsOfPose: wiredBoundsOfPose,
    planeOfNode: wiredPlaneOfNode,
    moveOptions: wiredMoveOptions,
  };
}
